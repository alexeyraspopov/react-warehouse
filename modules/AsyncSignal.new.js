import Signal from './Signal.new';
import noop from './noop';

export default class AsyncSignal extends Signal {
  constructor() {
    super();
    this.current = { id: null, cancel: noop };
  }

  publish(data) {
    this.current.cancel();
    if (typeof data === 'function') {
      let id = Math.random();
      let result = data();
      let [promise, onCancel] = Array.isArray(result) ? result : [result, noop];
      let state = { cancelled: false };
      let resolve = (result) => {
        if (!state.cancelled && this.current.id === id) {
          this.current = { id: null, cancel: noop };
          super.publish(result);
        }
      };
      let cancel = () => {
        if (this.current.id === id) {
          state.cancelled = true;
          onCancel();
        }
      };
      this.current = { id, cancel };
      promise.then(resolve).catch(resolve);
    } else {
      this.current = { id: null, cancel: noop };
      super.publish(data);
    }
  }
}
