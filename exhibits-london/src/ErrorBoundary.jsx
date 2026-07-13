import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.fallback = props.fallback || <h2>Something went wrong.</h2>;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.fallback;
    }
    return this.props.children;
  }
}