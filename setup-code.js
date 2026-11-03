/* Decodes the setup codes printed on smart home labels, in the browser or under Node.
   Matter: the MT: onboarding payload (Matter Core Specification 5.1.3, base-38, 88 bit header,
   least significant bit first) and the manual pairing code (5.1.4, Verhoeff check digit).
   HomeKit: the X-HM:// setup payload (nine base-36 characters carrying a 45 bit word, then a four
   character setup ID) and the eight digit setup code.
   Nothing here touches the network: every result is computed from the text given. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./vendor/qrcode-generator-1.4.4.js"));
  } else {
    root.SetupCode = factory(root.qrcode);
  }
}(typeof self !== "undefined" ? self : this, function (qrcode) {
  "use strict";

  var MATTER_PREFIX = "MT:";
  var MATTER_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.";
  var MATTER_HEADER_BYTES = 11;
  var HOMEKIT_PREFIX = "X-HM://";

  /* Passcodes the specification forbids (Matter 5.1.7). The same list is prohibited for HomeKit
     setup codes, as eight digit strings. */
  var FORBIDDEN = [0, 11111111, 22222222, 33333333, 44444444, 55555555, 66666666, 77777777,
    88888888, 99999999, 12345678, 87654321];

  var HOMEKIT_CATEGORIES = {
    1: "Other", 2: "Bridge", 3: "Fan", 4: "Garage door opener", 5: "Lightbulb", 6: "Door lock",
    7: "Outlet", 8: "Switch", 9: "Thermostat", 10: "Sensor", 11: "Security system", 12: "Door",
    13: "Window", 14: "Window covering", 15: "Programmable switch", 16: "Range extender",
    17: "IP camera", 18: "Video doorbell", 19: "Air purifier", 20: "Heater", 21: "Air conditioner",
    22: "Humidifier", 23: "Dehumidifier", 26: "Speaker", 28: "Sprinkler", 29: "Faucet",
    30: "Shower head", 31: "Television", 32: "Remote", 33: "Wi-Fi router", 34: "Audio receiver",
    35: "TV set top box", 36: "TV streaming stick"
  };

  var FLOW_NAMES = ["Standard", "User intent", "Custom"];
  var DISCOVERY_NAMES = ["Soft-AP", "Bluetooth LE", "On the network", "Wi-Fi PAF", "NFC"];
  var MAX_INPUT = 600;

  function isForbidden(code) { return FORBIDDEN.indexOf(code) !== -1; }

  function pad(value, width) {
    var s = String(value);
    while (s.length < width) s = "0" + s;
    return s;
  }

  /* Bits, least significant first, across a byte array. Fields are at most 27 bits wide, so
     plain numbers hold them. */
  function readBits(bytes, start, count) {
    var value = 0;
    for (var i = 0; i < count; i++) {
      var index = start + i;
      var bit = (bytes[index >> 3] >> (index & 7)) & 1;
      value += bit * Math.pow(2, i);
    }
    return value;
  }

  function writeBits(bytes, start, count, value) {
    for (var i = 0; i < count; i++) {
      var bit = Math.floor(value / Math.pow(2, i)) % 2;
      var index = start + i;
      if (bit) bytes[index >> 3] |= (1 << (index & 7));
    }
  }

  /* Base-38, in chunks: five characters carry three bytes, four carry two, two carry one.
     Within a chunk the first character is the least significant. */
  function decodeBase38(text) {
    var bytes = [];
    var index = 0;
    while (index < text.length) {
      var remaining = text.length - index;
      var chunk, count;
      if (remaining >= 5) { chunk = 5; count = 3; }
      else if (remaining === 4) { chunk = 4; count = 2; }
      else if (remaining === 2) { chunk = 2; count = 1; }
      else return null;
      var value = 0;
      var multiplier = 1;
      for (var i = 0; i < chunk; i++) {
        var digit = MATTER_ALPHABET.indexOf(text.charAt(index + i));
        if (digit === -1) return null;
        value += digit * multiplier;
        multiplier *= 38;
      }
      if (value >= Math.pow(2, 8 * count)) return null;
      for (var b = 0; b < count; b++) {
        bytes.push(value % 256);
        value = Math.floor(value / 256);
      }
      index += chunk;
    }
    return bytes;
  }

  function encodeBase38(bytes) {
    var out = "";
    var index = 0;
    while (index < bytes.length) {
      var remaining = bytes.length - index;
      var count = remaining >= 3 ? 3 : remaining;
      var chars = count === 3 ? 5 : count === 2 ? 4 : 2;
      var value = 0;
      for (var b = count - 1; b >= 0; b--) value = value * 256 + bytes[index + b];
      for (var i = 0; i < chars; i++) {
        out += MATTER_ALPHABET.charAt(value % 38);
        value = Math.floor(value / 38);
      }
      index += count;
    }
    return out;
  }

  /* Verhoeff check digit (Matter 5.1.4.1). */
  var D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];
  var P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];
  var INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

  function verhoeff(digits) {
    var c = 0;
    for (var i = 0; i < digits.length; i++) {
      var digit = digits.charCodeAt(digits.length - 1 - i) - 48;
      c = D[c][P[(i + 1) % 8][digit]];
    }
    return String(INV[c]);
  }

  function groupManual(code) {
    if (code.length === 11) return code.slice(0, 4) + "-" + code.slice(4, 7) + "-" + code.slice(7);
    return code.slice(0, 4) + "-" + code.slice(4, 7) + "-" + code.slice(7, 11) + "-" +
      code.slice(11, 16) + "-" + code.slice(16);
  }

  function groupHomeKit(code) {
    return code.slice(0, 3) + "-" + code.slice(3, 5) + "-" + code.slice(5);
  }

  function manualCodeFor(fields) {
    var shortDiscriminator = fields.discriminator >> 8;
    var withVendor = fields.commissioningFlow !== 0;
    var digit1 = (withVendor ? 4 : 0) | (shortDiscriminator >> 2);
    var digits2to6 = ((shortDiscriminator & 3) << 14) | (fields.passcode & 0x3FFF);
    var digits7to10 = fields.passcode >> 14;
    var body = String(digit1) + pad(digits2to6, 5) + pad(digits7to10, 4);
    if (withVendor) body += pad(fields.vendorID, 5) + pad(fields.productID, 5);
    return body + verhoeff(body);
  }

  /* The bytes after the header are optional data: nothing, or one anonymous TLV structure
     (Matter 5.1.5). Context tag 0 is the serial number, as text or a number; tags 0x80 to 0xFF
     are the maker's own. Anything else, or a malformed structure, is not a Matter payload. */
  function utf8(bytes, start, length) {
    var slice = bytes.slice(start, start + length);
    try {
      if (typeof TextDecoder !== "undefined") {
        /* ignoreBOM keeps a leading byte order mark as a character, as the fallback does. */
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new Uint8Array(slice));
      }
      return decodeURIComponent(slice.map(function (b) { return "%" + (b < 16 ? "0" : "") + b.toString(16); }).join(""));
    } catch (e) {
      return null;
    }
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") return Array.prototype.slice.call(new TextEncoder().encode(text));
    var encoded = encodeURIComponent(text);
    var out = [];
    for (var i = 0; i < encoded.length; i++) {
      if (encoded.charAt(i) === "%") { out.push(parseInt(encoded.substr(i + 1, 2), 16)); i += 2; }
      else out.push(encoded.charCodeAt(i));
    }
    return out;
  }

  function readTLV(bytes, start) {
    var pos = start;
    if (pos >= bytes.length) return null;
    var control = bytes[pos++];
    var tagForm = control >> 5;
    var type = control & 0x1F;
    var tagLength = [0, 1, 2, 4, 2, 4, 6, 8][tagForm];
    /* Implicit profile tags (forms 4 and 5) need a profile the payload never establishes. */
    if (tagForm === 4 || tagForm === 5) return null;
    if (pos + tagLength > bytes.length) return null;
    var tag = tagForm === 1 ? bytes[pos] : null;
    /* The tag's identity, not its encoding: a common profile tag is the fully qualified tag with
       vendor 0 and profile 0, and a tag number means the same at 2 or 4 bytes. */
    var tagKey;
    if (tagForm === 0) tagKey = "anonymous";
    else if (tagForm === 1) tagKey = "context:" + tag;
    else {
      var le = function (at, width) { var v = 0; for (var i = width - 1; i >= 0; i--) v = v * 256 + bytes[at + i]; return v; };
      var vendor = tagForm >= 6 ? le(pos, 2) : 0;
      var profile = tagForm >= 6 ? le(pos + 2, 2) : 0;
      var number = le(pos + (tagForm >= 6 ? 4 : 0), tagForm === 2 || tagForm === 6 ? 2 : 4);
      tagKey = "profile:" + vendor + ":" + profile + ":" + number;
    }
    pos += tagLength;
    var element = { tagForm: tagForm, tag: tag, tagKey: tagKey, type: type, end: 0, value: null };
    function uint(width) {
      if (pos + width > bytes.length) return null;
      var v = 0;
      for (var i = width - 1; i >= 0; i--) v = v * 256 + bytes[pos + i];
      pos += width;
      return v;
    }
    if (type <= 0x07) {
      var width = 1 << (type & 3);
      if (pos + width > bytes.length) return null;
      element.raw = bytes.slice(pos, pos + width);
      var v = uint(width);
      element.value = type <= 0x03 && width <= 4 && v >= Math.pow(2, 8 * width - 1) ? v - Math.pow(2, 8 * width) : v;
    } else if (type === 0x08 || type === 0x09) {
      element.value = type === 0x09;
    } else if (type === 0x0A || type === 0x0B) {
      if (uint(type === 0x0A ? 4 : 8) === null) return null;
    } else if (type >= 0x0C && type <= 0x13) {
      var length = uint(1 << (type & 3));
      if (length === null || pos + length > bytes.length) return null;
      element.byteLength = length;
      if (type <= 0x0F) {
        var text = utf8(bytes, pos, length);
        if (text === null) return null;
        element.value = text;
      }
      pos += length;
    } else if (type === 0x14) {
      element.value = null;
    } else if (type >= 0x15 && type <= 0x17) {
      element.children = [];
      var keys = {};
      for (;;) {
        if (pos >= bytes.length) return null;
        if (bytes[pos] === 0x18) { pos += 1; break; }
        var child = readTLV(bytes, pos);
        if (!child) return null;
        /* A structure's members carry tags; an array's members carry none; a list may do either. */
        if (type === 0x15 && child.tagForm === 0) return null;
        if (type === 0x16 && child.tagForm !== 0) return null;
        /* Tags are unique within a structure (A.5.1). */
        if (type === 0x15) {
          if (keys[child.tagKey]) return null;
          keys[child.tagKey] = true;
        }
        element.children.push(child);
        pos = child.end;
      }
    } else {
      return null;
    }
    element.end = pos;
    return element;
  }

  function decimalOf(raw) {
    var digits = [0];
    for (var i = raw.length - 1; i >= 0; i--) {
      var carry = raw[i];
      for (var d = 0; d < digits.length; d++) {
        var v = digits[d] * 256 + carry;
        digits[d] = v % 10;
        carry = Math.floor(v / 10);
      }
      while (carry > 0) { digits.push(carry % 10); carry = Math.floor(carry / 10); }
    }
    return digits.reverse().join("");
  }

  var COMMON_TAGS = { 1: "pbkdfIterations", 2: "pbkdfSalt", 3: "deviceCount", 4: "commissioningTimeout" };

  function readOptionalData(bytes) {
    var info = { serialNumber: null, vendorElements: 0, deviceCount: null, commissioningTimeout: null };
    if (bytes.length === MATTER_HEADER_BYTES) return info;
    var top = readTLV(bytes, MATTER_HEADER_BYTES);
    if (!top || top.end !== bytes.length || top.type !== 0x15 || top.tagForm !== 0) return null;
    var seen = { iterations: false, salt: false };
    for (var i = 0; i < top.children.length; i++) {
      var child = top.children[i];
      if (child.tagForm !== 1) return null;
      if (child.tag === 0) {
        if (typeof child.value === "string") {
          /* A serial number is 1 to 32 bytes of printable text: no C0 or C1 control characters. */
          if (child.byteLength < 1 || child.byteLength > 32) return null;
          if (/[\u0000-\u001F\u007F-\u009F]/.test(child.value)) return null;
          info.serialNumber = child.value;
        } else if (child.type >= 0x04 && child.type <= 0x07) {
          info.serialNumber = decimalOf(child.raw);
        } else {
          return null;
        }
      } else if (COMMON_TAGS[child.tag]) {
        /* Tags 1 to 4 (5.1.5.2): PBKDF iterations (1,000 to 100,000, with its salt of 16 to 32
           bytes), device count (1 to 255) and commissioning timeout (180 to 900 seconds). An
           unsigned value may be sent in more octets than it needs, so the range is checked on the
           value, not the width. */
        if (child.tag === 2) {
          if (child.type < 0x10 || child.type > 0x13) return null;
          if (child.byteLength < 16 || child.byteLength > 32) return null;
          seen.salt = true;
        } else {
          if (child.type < 0x04 || child.type > 0x07) return null;
          var decimal = decimalOf(child.raw);
          if (decimal.length > 15) return null;
          var number = parseInt(decimal, 10);
          var range = child.tag === 1 ? [1000, 100000] : child.tag === 3 ? [1, 255] : [180, 900];
          if (number < range[0] || number > range[1]) return null;
          if (child.tag === 1) seen.iterations = true;
          else info[COMMON_TAGS[child.tag]] = number;
        }
      } else if (child.tag >= 0x80) {
        info.vendorElements += 1;
      } else {
        return null;
      }
    }
    /* The PBKDF parameters come as a pair or not at all. */
    if (seen.iterations !== seen.salt) return null;
    return info;
  }

  function discoveryNames(bits) {
    var names = [];
    for (var i = 0; i < DISCOVERY_NAMES.length; i++) if (bits & (1 << i)) names.push(DISCOVERY_NAMES[i]);
    return names;
  }

  function error(reason, message) { return { kind: "error", reason: reason, message: message }; }

  /* MT: payload. Concatenated payloads (5.1.3.2) join segments with "*"; the first belongs to the
     device the label is on, and every further one must decode as well. */
  function decodeMatterPayload(whole) {
    var segments = whole.split("*");
    var head = segments[0];
    for (var s = 1; s < segments.length; s++) {
      if (decodeMatterSegment(MATTER_PREFIX + segments[s]).kind === "error") {
        return error("matter-segment", "One of the joined payloads after the first does not decode.");
      }
    }
    var r = decodeMatterSegment(head);
    if (r.kind !== "error") {
      r.payload = whole;
      r.extraSegments = segments.length - 1;
    }
    return r;
  }

  function decodeMatterSegment(text) {
    var body = text.slice(MATTER_PREFIX.length);
    if (body.length < 19) return error("matter-short", "A Matter payload has at least 19 characters after MT:.");
    var bytes = decodeBase38(body);
    if (!bytes) return error("matter-chars", "A Matter payload uses only 0 to 9, A to Z, a hyphen and a full stop, in chunks of five.");
    if (bytes.length < MATTER_HEADER_BYTES) return error("matter-short", "A Matter payload has at least 19 characters after MT:.");
    var version = readBits(bytes, 0, 3);
    var vendorID = readBits(bytes, 3, 16);
    var productID = readBits(bytes, 19, 16);
    var flow = readBits(bytes, 35, 2);
    var capabilities = readBits(bytes, 37, 8);
    var discriminator = readBits(bytes, 45, 12);
    var passcode = readBits(bytes, 57, 27);
    var padding = readBits(bytes, 84, 4);
    if (version !== 0 || padding !== 0 || flow > 2) return error("matter-invalid", "The text decodes, but not as a Matter payload: the version or the padding bits are wrong.");
    if (passcode > 99999998 || isForbidden(passcode)) return error("matter-passcode", "The payload carries a passcode the Matter specification forbids, so no device was made with it.");
    if (vendorID > 0xFFF4) return error("matter-vendor", "The vendor ID is above the highest one the Connectivity Standards Alliance assigns.");
    if (productID === 0 && vendorID !== 0) return error("matter-product", "A product ID of 0 is not valid for a named vendor.");
    var optional = readOptionalData(bytes);
    if (!optional) return error("matter-optional", "The header decodes, but the data after it is not the structure a Matter payload may carry.");
    var fields = {
      kind: "matter-qr", version: version, vendorID: vendorID, productID: productID,
      commissioningFlow: flow, commissioningFlowName: FLOW_NAMES[flow],
      discoveryCapabilities: capabilities, discoveryNames: discoveryNames(capabilities),
      discriminator: discriminator, shortDiscriminator: discriminator >> 8, passcode: passcode,
      payload: text, extraSegments: 0, serialNumber: optional.serialNumber, vendorElements: optional.vendorElements,
      deviceCount: optional.deviceCount, commissioningTimeout: optional.commissioningTimeout
    };
    fields.manualCode = manualCodeFor(fields);
    fields.manualCodeGrouped = groupManual(fields.manualCode);
    return fields;
  }

  /* Manual pairing code, 11 or 21 digits, exactly the rules a commissioner applies. */
  function decodeManualCode(digits) {
    var first = digits.charCodeAt(0) - 48;
    if (first >= 8) return error("manual-first", "A manual pairing code never starts with 8 or 9.");
    var withVendor = first >= 4;
    if (withVendor !== (digits.length === 21)) {
      return error("manual-length", withVendor
        ? "A code that starts with 4 to 7 carries the vendor and product and has 21 digits."
        : "A code that starts with 0 to 3 has 11 digits.");
    }
    if (verhoeff(digits.slice(0, -1)) !== digits.slice(-1)) return error("check-digit", "The last digit does not match the others. At least one digit was misread or mistyped.");
    var digits2to6 = parseInt(digits.slice(1, 6), 10);
    var digits7to10 = parseInt(digits.slice(6, 10), 10);
    if (digits2to6 > 0xFFFF || digits7to10 > 0x1FFF) return error("manual-range", "The check digit matches, but the digits are outside the range a device can carry.");
    var shortDiscriminator = ((first & 3) << 2) | (digits2to6 >> 14);
    var passcode = (digits2to6 & 0x3FFF) + digits7to10 * 16384;
    if (passcode < 1 || passcode > 99999998 || isForbidden(passcode)) return error("matter-passcode", "The code carries a passcode the Matter specification forbids, so no device was made with it.");
    var r = {
      kind: "matter-manual", manualCode: digits, manualCodeGrouped: groupManual(digits),
      passcode: passcode, shortDiscriminator: shortDiscriminator, vendorID: undefined, productID: undefined
    };
    if (withVendor) {
      var vid = parseInt(digits.slice(10, 15), 10);
      var pid = parseInt(digits.slice(15, 20), 10);
      if (vid > 0xFFF4 || pid > 0xFFFF || (pid === 0 && vid !== 0)) return error("manual-range", "The check digit matches, but the vendor or product number is outside the assigned range.");
      r.vendorID = vid;
      r.productID = pid;
    }
    return r;
  }

  /* X-HM:// payload: nine base-36 characters, then a four character setup ID. The 45 bit word:
     bits 43 to 45 version and 39 to 42 reserved, both zero; 31 to 38 the category; 30 reserved in
     Apple's open ADK but set on some real labels, so not checked; 29 BLE, 28 IP, 27 already paired
     (a programmable NFC tag's payload, with no setup code); 0 to 26 the setup code. */
  function decodeHomeKitPayload(text) {
    var body = text.slice(HOMEKIT_PREFIX.length);
    if (!/^[0-9A-Z]{9}[0-9A-Z]{4}$/.test(body)) return error("homekit-shape", "A HomeKit payload is X-HM:// followed by exactly 13 letters or digits.");
    var word = parseInt(body.slice(0, 9), 36);
    var high = Math.floor(word / Math.pow(2, 27));
    var category = Math.floor(word / Math.pow(2, 31)) & 0xFF;
    var upper = Math.floor(word / Math.pow(2, 39));
    var ble = (high >> 2) & 1;
    var ip = (high >> 1) & 1;
    var paired = high & 1;
    var code = word % Math.pow(2, 27);
    if (upper !== 0 || category === 0 || (!ble && !ip)) return error("homekit-invalid", "The text decodes, but not as a HomeKit payload: it names no accessory category or no pairing transport.");
    if (paired) return error("homekit-paired", "This payload says the accessory is already paired. An accessory with a programmable NFC tag advertises this once it has a home, and it carries no setup code.");
    if (code > 99999999 || isForbidden(code)) return error("homekit-code", "The payload carries a setup code HomeKit forbids, so no accessory was made with it.");
    var transports = [];
    if (ip) transports.push("IP");
    if (ble) transports.push("Bluetooth LE");
    var setupCode = pad(code, 8);
    return {
      kind: "homekit-qr", payload: text, setupCode: setupCode, setupCodeGrouped: groupHomeKit(setupCode),
      category: category, categoryName: HOMEKIT_CATEGORIES[category] || "Category " + category,
      transports: transports, setupID: body.slice(9)
    };
  }

  function decodeHomeKitCode(digits) {
    if (isForbidden(parseInt(digits, 10))) return error("homekit-code", "HomeKit never issues a code made of one repeated digit, 12345678 or 87654321.");
    return { kind: "homekit-code", setupCode: digits, setupCodeGrouped: groupHomeKit(digits) };
  }

  function decode(input) {
    if (typeof input !== "string") return error("unknown", "");
    if (input.length > MAX_INPUT) return error("too-long", "That is longer than any setup code or QR text. Paste only the code.");
    var text = input.replace(/[\u00A0\u2007\u202F\u3000]/g, " ").replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-").trim();
    if (!text) return error("empty", "");
    if (/[^\x00-\x7F]/.test(text)) return error("unknown", "");
    var upper = text.toUpperCase();
    if (upper.indexOf(MATTER_PREFIX) === 0) return decodeMatterPayload(upper);
    if (upper.indexOf(HOMEKIT_PREFIX) === 0) return decodeHomeKitPayload(upper);
    var digits = text.replace(/[\s\-]/g, "");
    if (/^\d+$/.test(digits)) {
      if (digits.length === 11 || digits.length === 21) return decodeManualCode(digits);
      if (digits.length === 8) return decodeHomeKitCode(digits);
      return error("unknown", "");
    }
    return error("unknown", "");
  }

  function encodeMatter(f) {
    var bytes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (f.optionalBytes) {
      bytes = bytes.concat(f.optionalBytes);
    } else if (f.serialNumber) {
      var serial = utf8Bytes(f.serialNumber);
      bytes = bytes.concat([0x15, 0x2C, 0x00, serial.length], serial, [0x18]);
    }
    writeBits(bytes, 0, 3, 0);
    writeBits(bytes, 3, 16, f.vendorID);
    writeBits(bytes, 19, 16, f.productID);
    writeBits(bytes, 35, 2, f.commissioningFlow);
    writeBits(bytes, 37, 8, f.discoveryCapabilities);
    writeBits(bytes, 45, 12, f.discriminator);
    writeBits(bytes, 57, 27, f.passcode);
    return MATTER_PREFIX + encodeBase38(bytes);
  }

  function encodeHomeKit(f) {
    var word = f.category * Math.pow(2, 31) + (f.ble ? 1 : 0) * Math.pow(2, 29) +
      (f.ip ? 1 : 0) * Math.pow(2, 28) + (f.paired ? 1 : 0) * Math.pow(2, 27) + parseInt(f.setupCode, 10);
    return HOMEKIT_PREFIX + pad(word.toString(36).toUpperCase(), 9) + f.setupID.toUpperCase();
  }

  /* QR modules for a payload, as rows of booleans, at error correction M. Matter payloads use the
     QR alphanumeric set (5.1.3), which also covers X-HM:// payloads; anything else goes as bytes. */
  function qrModules(text) {
    var qr = qrcode(0, "M");
    qr.addData(text, /^[0-9A-Z $%*+\-.\/:]*$/.test(text) ? "Alphanumeric" : "Byte");
    qr.make();
    var n = qr.getModuleCount();
    var rows = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(qr.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }

  /* Raw header bytes to a payload, for tests that need an invalid header. */
  function encodeMatterRaw(bytes) { return MATTER_PREFIX + encodeBase38(bytes); }

  return {
    decode: decode, encodeMatter: encodeMatter, encodeMatterRaw: encodeMatterRaw, encodeHomeKit: encodeHomeKit, qrModules: qrModules,
    verhoeff: verhoeff, categories: HOMEKIT_CATEGORIES
  };
}));
