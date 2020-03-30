export default function Signal() {
  let subscribers = new Map();
  return {
    publish(key) {
      if (subscribers.has(key)) {
        subscribers
          .get(key)
          .slice()
          .forEach((fn) => fn());
      }
    },
    subscribe(key, fn) {
      if (subscribers.has(key)) {
        subscribers.get(key).push(fn);
      } else {
        subscribers.set(key, [fn]);
      }
      return () => {
        let list = subscribers.get(key);
        list.splice(list.indexOf(fn) >>> 0, 1);
        if (list.length === 0) {
          subscribers.delete(key);
        }
      };
    },
  };
}
