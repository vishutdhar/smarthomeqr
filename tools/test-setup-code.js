#!/usr/bin/env node
// Checks for setup-code.js against the vectors the Matter and HomeKit specifications fix.
// Run: node tools/test-setup-code.js
"use strict";
const assert = require("assert");
const S = require("../setup-code.js");

let n = 0;
function t(name, fn) { fn(); n += 1; console.log("ok " + name); }

t("Matter test vendor QR decodes to the spec fields and the 11 digit code", () => {
  const r = S.decode("MT:Y.K9042C00KA0648G00");
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.version, 0);
  assert.strictEqual(r.vendorID, 0xFFF1);
  assert.strictEqual(r.productID, 0x8000);
  assert.strictEqual(r.commissioningFlow, 0);
  assert.strictEqual(r.discriminator, 3840);
  assert.strictEqual(r.passcode, 20202021);
  assert.strictEqual(r.manualCode, "34970112332");
  assert.strictEqual(r.manualCodeGrouped, "3497-011-2332");
  assert.strictEqual(r.payload, "MT:Y.K9042C00KA0648G00");
});

t("lower case, surrounding space and a stray line break are accepted", () => {
  const r = S.decode("  mt:y.k9042c00ka0648g00\n");
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.manualCode, "34970112332");
});

t("second spec vector: on network discovery and product 0x8001", () => {
  const r = S.decode("MT:-24J0AFN00KA0648G00");
  assert.strictEqual(r.productID, 0x8001);
  assert.deepStrictEqual(r.discoveryNames, ["On the network"]);
  assert.strictEqual(r.manualCode, "34970112332");
});

t("custom flow payload yields the 21 digit code with vendor and product", () => {
  const p = S.encodeMatter({ vendorID: 0xFFF1, productID: 0x8001, commissioningFlow: 2, discoveryCapabilities: 4, discriminator: 3840, passcode: 20202021 });
  const r = S.decode(p);
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.commissioningFlow, 2);
  assert.strictEqual(r.manualCode, "749701123365521327694");
  assert.strictEqual(r.manualCodeGrouped, "7497-011-2336-55213-27694");
});

t("11 digit manual code parses and the check digit is verified", () => {
  const r = S.decode("3497-011-2332");
  assert.strictEqual(r.kind, "matter-manual");
  assert.strictEqual(r.passcode, 20202021);
  assert.strictEqual(r.shortDiscriminator, 15);
  assert.strictEqual(r.vendorID, undefined);
  assert.strictEqual(r.manualCodeGrouped, "3497-011-2332");
});

t("21 digit manual code carries vendor and product", () => {
  const r = S.decode("749701123365521327694");
  assert.strictEqual(r.kind, "matter-manual");
  assert.strictEqual(r.vendorID, 65521);
  assert.strictEqual(r.productID, 32769);
});

t("a misread digit fails the check digit with a specific reason", () => {
  const r = S.decode("34970112333");
  assert.strictEqual(r.kind, "error");
  assert.strictEqual(r.reason, "check-digit");
});

t("header rules: version, padding and flow 3 are refused; HomeKit upper bits and BLE are read", () => {
  const h = (f) => S.encodeMatter(Object.assign({ vendorID: 0xFFF1, productID: 0x8001, commissioningFlow: 0, discoveryCapabilities: 2, discriminator: 3840, passcode: 20202021 }, f));
  assert.strictEqual(S.decode(h({ commissioningFlow: 3 })).reason, "matter-invalid");
  // Version 1 (bit 0 of the first byte) and padding (bits 84 to 87) set on the spec vector's bytes.
  assert.strictEqual(S.decode(S.encodeMatterRaw([1, 255, 7, 0, 68, 0, 224, 75, 132, 104, 2])).reason, "matter-invalid");
  assert.strictEqual(S.decode(S.encodeMatterRaw([136, 255, 7, 0, 68, 0, 224, 75, 132, 104, 2 | 0x10])).reason, "matter-invalid");
  assert.strictEqual(S.decode(S.encodeMatterRaw([136, 255, 7, 0, 68, 0, 224, 75, 132, 104, 2])).kind, "matter-qr");
  const hk = S.encodeHomeKit({ category: 6, ip: false, ble: true, paired: false, setupCode: "48219735", setupID: "ABCD" });
  assert.deepStrictEqual(S.decode(hk).transports, ["Bluetooth LE"]);
  assert.strictEqual(S.decode(hk).categoryName, "Door lock");
  // Version bits 43 to 45 set: the word 2^43 plus a valid lock payload.
  const word = parseInt(hk.slice(7, 16), 36) + Math.pow(2, 43);
  const bad = "X-HM://" + word.toString(36).toUpperCase() + "ABCD";
  assert.strictEqual(S.decode(bad).reason, "homekit-invalid");
});

t("forbidden Matter passcodes are refused", () => {
  // 12345678 encoded as the test vendor would: build the payload and expect a refusal.
  const bad = S.encodeMatter({ vendorID: 0xFFF1, productID: 0x8001, commissioningFlow: 0, discoveryCapabilities: 4, discriminator: 3840, passcode: 12345678 });
  assert.strictEqual(S.decode(bad).kind, "error");
});

t("Matter encode and decode round trip", () => {
  const f = { vendorID: 0x1349, productID: 0x0042, commissioningFlow: 1, discoveryCapabilities: 6, discriminator: 0xABC, passcode: 48651234 };
  const p = S.encodeMatter(f);
  const r = S.decode(p);
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.vendorID, f.vendorID);
  assert.strictEqual(r.productID, f.productID);
  assert.strictEqual(r.commissioningFlow, 1);
  assert.strictEqual(r.discoveryCapabilities, 6);
  assert.strictEqual(r.discriminator, 0xABC);
  assert.strictEqual(r.passcode, f.passcode);
  assert.strictEqual(r.manualCode.length, 21);
  // The manual code and the QR agree on the passcode and the short discriminator.
  const m = S.decode(r.manualCode);
  assert.strictEqual(m.passcode, f.passcode);
  assert.strictEqual(m.shortDiscriminator, 0xABC >> 8);
  assert.strictEqual(m.vendorID, f.vendorID);
});

t("concatenated payloads keep every segment and decode the first", () => {
  const r = S.decode("MT:Y.K9042C00KA0648G00*Y.K9042C00KA0648G00");
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.payload, "MT:Y.K9042C00KA0648G00*Y.K9042C00KA0648G00");
  assert.strictEqual(r.extraSegments, 1);
});

t("HomeKit payload decodes to the 8 digit code, category and transports", () => {
  const p = S.encodeHomeKit({ category: 5, ip: true, ble: false, paired: false, setupCode: "03145154", setupID: "HSPN" });
  assert.strictEqual(p.slice(0, 7), "X-HM://");
  assert.strictEqual(p.length, 7 + 13);
  const r = S.decode(p);
  assert.strictEqual(r.kind, "homekit-qr");
  assert.strictEqual(r.setupCode, "03145154");
  assert.strictEqual(r.setupCodeGrouped, "031-45-154");
  assert.strictEqual(r.category, 5);
  assert.strictEqual(r.categoryName, "Lightbulb");
  assert.deepStrictEqual(r.transports, ["IP"]);
  assert.strictEqual(r.setupID, "HSPN");
});

t("HomeKit payload with digits after the prefix but no category is refused", () => {
  assert.strictEqual(S.decode("X-HM://000000001ABCD").kind, "error");
  // A transport but no category.
  assert.strictEqual(S.decode("X-HM://0004HOWXUABCD").reason, "homekit-invalid");
});

t("8 digit HomeKit code is grouped, and the prohibited patterns are refused", () => {
  const r = S.decode("482-19-735");
  assert.strictEqual(r.kind, "homekit-code");
  assert.strictEqual(r.setupCode, "48219735");
  assert.strictEqual(r.setupCodeGrouped, "482-19-735");
  assert.strictEqual(S.decode("12345678").kind, "error");
  assert.strictEqual(S.decode("11111111").kind, "error");
});

t("other text is an error with the unknown reason", () => {
  assert.strictEqual(S.decode("").kind, "error");
  assert.strictEqual(S.decode("hello").kind, "error");
  assert.strictEqual(S.decode("MT:ABC").reason, "matter-short");
  assert.strictEqual(S.decode("123456789").reason, "unknown");
});

t("optional data: a serial number is read, vendor tags counted, junk refused", () => {
  const base = { vendorID: 0xFFF1, productID: 0x8001, commissioningFlow: 0, discoveryCapabilities: 2, discriminator: 3840, passcode: 20202021 };
  const p = S.encodeMatter(Object.assign({ serialNumber: "SN12345" }, base));
  const r = S.decode(p);
  assert.strictEqual(r.kind, "matter-qr");
  assert.strictEqual(r.serialNumber, "SN12345");
  assert.strictEqual(r.manualCode, "34970112332");
  const withBytes = (b) => S.decode(S.encodeMatter(Object.assign({ optionalBytes: b }, base)));
  // Vendor tag 0x80 as a one byte unsigned, plus a numeric serial of four bytes.
  let v = withBytes([0x15, 0x24, 0x80, 0x07, 0x26, 0x00, 0x78, 0x56, 0x34, 0x12, 0x18]);
  assert.strictEqual(v.kind, "matter-qr");
  assert.strictEqual(v.vendorElements, 1);
  assert.strictEqual(v.serialNumber, String(0x12345678));
  // A serial may be any unsigned width, read exactly; a signed serial is refused.
  assert.strictEqual(withBytes([0x15, 0x27, 0x00, 0, 0, 0, 0, 1, 0, 0, 0, 0x18]).serialNumber, "4294967296");
  assert.strictEqual(withBytes([0x15, 0x27, 0x00, 255, 255, 255, 255, 255, 255, 255, 255, 0x18]).serialNumber, "18446744073709551615");
  assert.strictEqual(withBytes([0x15, 0x27, 0x00, 1, 0, 0, 0, 0, 0, 0x20, 0, 0x18]).serialNumber, "9007199254740993");
  assert.strictEqual(withBytes([0x15, 0x20, 0x00, 0x07, 0x18]).reason, "matter-optional");
  // A serial string is 1 to 32 bytes.
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x00, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 32].concat(Array(32).fill(0x41), [0x18])).serialNumber, "A".repeat(32));
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 33].concat(Array(33).fill(0x41), [0x18])).reason, "matter-optional");
  // Common tags 1 to 4 are accepted with their types and ranges; 5 is reserved.
  const salt16 = [0x30, 0x02, 16].concat(Array(16).fill(0xAB));
  const common = withBytes([0x15, 0x24, 0x03, 0x02, 0x25, 0x04, 0x2C, 0x01, 0x25, 0x01, 0xE8, 0x03].concat(salt16, [0x18]));
  assert.strictEqual(common.kind, "matter-qr");
  assert.strictEqual(common.deviceCount, 2);
  assert.strictEqual(common.commissioningTimeout, 300);
  assert.strictEqual(withBytes([0x15, 0x2C, 0x03, 0x01, 0x41, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x24, 0x02, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x24, 0x05, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(S.decode("MT:-24J0AFN00KA064IJ3P0UZ710O0").deviceCount, 1);
  // Width is free, value is not: an 8 byte device count of 1 passes, 0 and 256 fail, 901 seconds fails.
  assert.strictEqual(withBytes([0x15, 0x27, 0x03, 1, 0, 0, 0, 0, 0, 0, 0, 0x18]).deviceCount, 1);
  assert.strictEqual(S.decode("MT:Y.K9042C00KA064IJ3P0XZ7100000000000Q940").deviceCount, 1);
  assert.strictEqual(S.decode("MT:Y.K9042C00KA064IJ3P0TPLE11000000000Q940").commissioningTimeout, 300);
  assert.strictEqual(withBytes([0x15, 0x24, 0x03, 0x00, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x03, 0x00, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x04, 0x85, 0x03, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x04, 0xB4, 0x00, 0x18]).commissioningTimeout, 180);
  // PBKDF: salt of 2 bytes fails, iterations without salt fail, iterations out of range fail.
  assert.strictEqual(withBytes([0x15, 0x30, 0x02, 0x02, 0xAA, 0xBB, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x01, 0xE8, 0x03, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x01, 0xE7, 0x03].concat(salt16, [0x18])).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15].concat(salt16, [0x18])).reason, "matter-optional");
  // A tag appears once per structure, at the top and inside vendor structures.
  assert.strictEqual(S.decode("MT:Y.K9042C00KA064IJ3P0UZ710GCF20O0").reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x24, 0x00, 0x01, 0x24, 0x00, 0x02, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x35, 0x80, 0x24, 0x01, 0x01, 0x24, 0x01, 0x02, 0x18, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x35, 0x80, 0x24, 0x01, 0x01, 0x24, 0x02, 0x02, 0x18, 0x18]).vendorElements, 1);
  // Range edges: 100,000 and 100,001 iterations; device count 255 and 256; timeout 179, 180, 900, 901; salt 32 and 33.
  const salt = (n) => [0x30, 0x02, n].concat(Array(n).fill(0xAB));
  assert.strictEqual(withBytes([0x15, 0x26, 0x01, 0xA0, 0x86, 0x01, 0x00].concat(salt(32), [0x18])).kind, "matter-qr");
  assert.strictEqual(withBytes([0x15, 0x26, 0x01, 0xA1, 0x86, 0x01, 0x00].concat(salt(16), [0x18])).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x01, 0xE8, 0x03].concat(salt(33), [0x18])).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x24, 0x03, 0xFF, 0x18]).deviceCount, 255);
  assert.strictEqual(withBytes([0x15, 0x25, 0x04, 0xB3, 0x00, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x25, 0x04, 0x84, 0x03, 0x18]).commissioningTimeout, 900);
  assert.strictEqual(withBytes([0x15, 0x27, 0x01, 0xE8, 0x03, 0, 0, 0, 0, 0, 0].concat(salt(16), [0x18])).kind, "matter-qr");
  // The same tag in two encodings is still a duplicate; a list may repeat tags.
  assert.strictEqual(S.decode("MT:Y.K9042C00KA064IJ3P0PYU52PE71065000OE710OMPS0O0").reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x35, 0x80, 0x44, 0x01, 0x00, 0x01, 0x64, 0x01, 0x00, 0x00, 0x00, 0x02, 0x18, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x37, 0x80, 0x24, 0x01, 0x01, 0x24, 0x01, 0x02, 0x18, 0x18]).vendorElements, 1);
  // Every later segment is checked too.
  assert.strictEqual(S.decode("MT:Y.K9042C00KA0648G00*Y.K9042C00KA064IJ3P0UZ710GCF20O0").reason, "matter-segment");
  // The serial limit counts bytes, not characters.
  assert.strictEqual(S.decode(S.encodeMatter(Object.assign({ serialNumber: "\u00e9".repeat(16) }, base))).serialNumber, "\u00e9".repeat(16));
  assert.strictEqual(S.decode(S.encodeMatter(Object.assign({ serialNumber: "\u00e9".repeat(17) }, base))).reason, "matter-optional");
  // The fallback decoder, used where TextDecoder is missing, agrees with the native one.
  const TD = global.TextDecoder;
  delete global.TextDecoder;
  try {
    assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x04, 0xEF, 0xBB, 0xBF, 0x41, 0x18]).serialNumber, "\uFEFFA");
    assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x02, 0xC3, 0xA9, 0x18]).serialNumber, "\u00e9");
    assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x01, 0xC3, 0x18]).reason, "matter-optional");
  } finally {
    global.TextDecoder = TD;
  }
  // Distinct tags stay distinct: vendor, profile and number each tell them apart, at both widths.
  const fq6 = (v, pr, n, val) => [0xC4, v & 255, v >> 8, pr & 255, pr >> 8, n & 255, n >> 8, val];
  const fq8 = (v, pr, n, val) => [0xE4, v & 255, v >> 8, pr & 255, pr >> 8, n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255, val];
  const pair = (a, b) => withBytes([0x15, 0x35, 0x80].concat(a, b, [0x18, 0x18]));
  assert.strictEqual(pair(fq6(1, 2, 3, 1), fq6(2, 2, 3, 1)).vendorElements, 1);
  assert.strictEqual(pair(fq6(1, 2, 3, 1), fq6(1, 3, 3, 1)).vendorElements, 1);
  assert.strictEqual(pair(fq6(1, 2, 3, 1), fq6(1, 2, 4, 1)).vendorElements, 1);
  assert.strictEqual(pair(fq6(1, 2, 3, 1), fq8(1, 2, 3 + 65536, 1)).vendorElements, 1);
  assert.strictEqual(pair(fq6(1, 2, 3, 1), fq8(1, 2, 3, 1)).reason, "matter-optional");
  assert.strictEqual(pair([0x44, 0x05, 0x00, 0x01], [0xC4, 0x00, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01]).reason, "matter-optional");
  // Serial zero and small widths.
  assert.strictEqual(withBytes([0x15, 0x24, 0x00, 0x00, 0x18]).serialNumber, "0");
  assert.strictEqual(withBytes([0x15, 0x25, 0x00, 0x39, 0x30, 0x18]).serialNumber, "12345");
  assert.strictEqual(withBytes([0x15, 0x26, 0x00, 255, 255, 255, 255, 0x18]).serialNumber, "4294967295");
  // UTF-8 in a serial string is text; invalid UTF-8 and control characters are not.
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x02, 0xC3, 0xA9, 0x18]).serialNumber, "\u00e9");
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x01, 0xC3, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x01, 0x0A, 0x18]).reason, "matter-optional");
  // Container rules: a structure member must carry a tag, an array member must not.
  assert.strictEqual(withBytes([0x15, 0x35, 0x80, 0x04, 0x01, 0x18, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x36, 0x80, 0x24, 0x00, 0x01, 0x18, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x36, 0x80, 0x04, 0x01, 0x18, 0x18]).vendorElements, 1);
  // A reserved low context tag, and a top level that is not a structure, are refused.
  assert.strictEqual(withBytes([0x15, 0x24, 0x07, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x04, 0x01]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x18, 0x15, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x18]).kind, "matter-qr");
  // Implicit profile tags, in both widths and inside a vendor structure, are refused.
  assert.strictEqual(withBytes([0x15, 0x84, 0x00, 0x00, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0xA4, 0x00, 0x00, 0x00, 0x00, 0x01, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x35, 0x80, 0x84, 0x00, 0x00, 0x01, 0x18, 0x18]).reason, "matter-optional");
  // A vendor string may hold a newline; a serial may not hold a C1 control; a byte order mark stays.
  assert.strictEqual(withBytes([0x15, 0x2C, 0x80, 0x01, 0x0A, 0x18]).vendorElements, 1);
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x02, 0xC2, 0x85, 0x18]).reason, "matter-optional");
  assert.strictEqual(withBytes([0x15, 0x2C, 0x00, 0x04, 0xEF, 0xBB, 0xBF, 0x41, 0x18]).serialNumber, "\uFEFFA");
  // The encoder writes UTF-8 bytes, so a non ASCII serial round trips.
  assert.strictEqual(S.decode(S.encodeMatter(Object.assign({ serialNumber: "\u00e9\u00e9" }, base))).serialNumber, "\u00e9\u00e9");
  // One extra base-38 chunk of zeros is a stray byte, not a TLV structure.
  assert.strictEqual(S.decode("MT:Y.K9042C00KA0648G0000").kind, "error");
  assert.strictEqual(S.decode("MT:Y.K9042C00KA0648G000").reason, "matter-optional");
});

t("NFC discovery is named, as the 2025 Matter SDK defines it", () => {
  const p = S.encodeMatter({ vendorID: 0xFFF1, productID: 0x8001, commissioningFlow: 0, discoveryCapabilities: 16, discriminator: 3840, passcode: 20202021 });
  assert.deepStrictEqual(S.decode(p).discoveryNames, ["NFC"]);
});

t("a HomeKit payload flagged as already paired is refused with its own reason", () => {
  const p = S.encodeHomeKit({ category: 5, ip: true, ble: false, paired: true, setupCode: "03145154", setupID: "HSPN" });
  assert.strictEqual(S.decode(p).reason, "homekit-paired");
});

t("non breaking spaces and dashes from a web page are normalised", () => {
  assert.strictEqual(S.decode("3497\u00A0011\u00A02332").kind, "matter-manual");
  assert.strictEqual(S.decode("3497\u2013011\u20132332").kind, "matter-manual");
  assert.strictEqual(S.decode("482\u201119\u2011735").kind, "homekit-code");
});

t("over long input is refused before any work", () => {
  assert.strictEqual(S.decode("MT:" + " ".repeat(40000) + "X").reason, "too-long");
});

t("Matter and HomeKit payloads encode in the alphanumeric set, so the QR stays small", () => {
  const ten = "MT:" + Array(10).fill("Y.K9042C00KA0648G00").join("*");
  assert.ok(S.qrModules(ten).length <= 49);
  assert.strictEqual(S.qrModules("MT:Y.K9042C00KA0648G00").length, 25);
  assert.strictEqual(S.qrModules("X-HM://00522H1VMHSPN").length, 21);
  assert.strictEqual(S.qrModules("x-hm://lower case").length, 25);
});

t("QR modules come out as rows of booleans for a payload", () => {
  const m = S.qrModules("MT:Y.K9042C00KA0648G00");
  assert.ok(m.length >= 21 && m.length % 4 === 1);
  assert.strictEqual(m[0].length, m.length);
  assert.strictEqual(typeof m[0][0], "boolean");
});

console.log(n + " checks passed");
