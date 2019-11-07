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
        for(let [key, value] of map.entries()) {
          map.delete(key);
          onDelete(value);
          break;
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
