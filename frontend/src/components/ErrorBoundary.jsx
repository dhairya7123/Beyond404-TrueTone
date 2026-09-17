import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#e0e5ec]">
          <div className="neu-card max-w-lg w-full p-8 text-center">
            <div className="neu-icon-red w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-xs text-slate-500 mb-4">
              An error occurred while rendering the screen. The details have been logged.
            </p>
            {this.state.error && (
              <div className="neu-inset p-3 rounded-xl text-left text-xs font-mono text-red-600 mb-6 max-h-36 overflow-auto">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => (window.location.href = "/")}
                className="neu-card-sm neu-press px-5 py-2.5 rounded-full text-xs font-semibold text-slate-700 inline-flex items-center gap-2"
              >
                <Home size={14} /> Back to Dashboard
              </button>
              <button
                onClick={this.handleReset}
                className="neu-btn-blue neu-press px-5 py-2.5 rounded-full text-xs font-semibold text-white inline-flex items-center gap-2"
              >
                <RefreshCw size={14} /> Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
