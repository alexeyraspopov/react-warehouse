export default class Signal {
  constructor() {
    this.head = null;
    this.tail = null;
  }
  subscribe(callback) {
    let node = { value: callback, prev: null, next: null };

    if (this.head == null) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }

    return {
      dispose: () => {
        if (node === this.head) {
          this.head = this.head.next;
          if (this.head !== null) {
            this.head.prev = null;
          }
          if (node === this.tail) {
            this.tail = null;
          }
        } else if (node === this.tail) {
          this.tail = this.tail.prev;
          this.tail.next = null;
        } else {
          node.prev.next = node.next;
          node.next.prev = node.prev;
        }
      },
    };
  }

  publish(data) {
    let cursor = this.head;
    while (cursor !== null) {
      let callback = cursor.value;
      callback(data);
      cursor = cursor.next;
    }
  }
}
