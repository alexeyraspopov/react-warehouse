export default function hashCode(object) {
  switch (typeof object) {
    case 'number':
      return hashNumber(object);
    case 'string':
      return hashString(object);
    case 'object':
    case 'function':
      return object === null ? 0x42108422 : hashObject(object);
    case 'boolean':
      return object ? 0x42108421 : 0x42108420;
    case 'undefined':
      return 0x42108423;
    default:
      throw new Error('Value type ' + typeof object + ' cannot be hashed.');
  }
}

// Compress arbitrarily large numbers into smi hashes.
function hashNumber(n) {
  if (n !== n || n === Infinity) {
    return 0;
  }
  let hash = n | 0;
  if (hash !== n) {
    hash ^= n * 0xffffffff;
  }
  while (n > 0xffffffff) {
    n /= 0xffffffff;
    hash ^= n;
  }
  return smi(hash);
}

function hashString(string) {
  // This is the hash from JVM
  // The hash code for a string is computed as
  // s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
  // where s[i] is the ith character of the string and n is the length of
  // the string. We "mod" the result to make it between 0 (inclusive) and 2^31
  // (exclusive) by dropping high bits.
  let hash = 0;
  for (let ii = 0; ii < string.length; ii++) {
    hash = (31 * hash + string.charCodeAt(ii)) | 0;
  }
  return smi(hash);
}

function hashObject(obj) {
  let hash = weakMap.get(obj);

  if (hash === undefined) {
    hash = ++objHashUID;
    if (objHashUID & 0x40000000) {
      objHashUID = 0;
    }
    weakMap.set(obj, hash);
  }

  return hash;
}

let weakMap = new WeakMap();
let objHashUID = 0;

// v8 has an optimization for storing 31-bit signed numbers.
// Values which have either 00 or 11 as the high order bits qualify.
// This function drops the highest order bit in a signed number, maintaining
// the sign bit.
function smi(i32) {
  return ((i32 >>> 1) & 0x40000000) | (i32 & 0xbfffffff);
}
