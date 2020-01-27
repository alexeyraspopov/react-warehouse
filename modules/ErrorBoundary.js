import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    let onError = this.props.onError;
    if (typeof onError === 'function') {
      onError(error);
    }
  }

  render() {
    return this.state.error !== null
      ? this.props.fallback
      : this.props.children;
  }
}
