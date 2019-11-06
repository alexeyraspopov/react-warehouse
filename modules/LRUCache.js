export default function LRUCache(capacity, onDelete) {
  let map = new Map();
  return {
    has(key) {
      return map.has(key);
    },
    get(key) {
      let value = map.get(key);
      if (value != null) {
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      if (map.size > capacity) {
        let firstEntry = map.entries().next();
        if (!firstEntry.done) {
          let entry = firstEntry.value;
          map.delete(entry[0]);
          onDelete(entry[1]);
        }
      }
    },
    delete(key) {
      map.delete(key);
    },
    size() {
      return map.size;
    },
  };
}
