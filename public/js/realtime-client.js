(function () {
  if (!window.io) {
    return;
  }

  const socket = window.io();
  const listeners = {
    state: new Set(),
    appEvent: new Set()
  };

  function notifyState(state) {
    listeners.state.forEach((callback) => {
      try {
        callback(state);
      } catch (_) {
        // Ignore listener errors so one bad consumer does not break others.
      }
    });

    document.dispatchEvent(new CustomEvent("fiscus:realtime-state", { detail: state }));
  }

  function notifyAppEvent(payload) {
    listeners.appEvent.forEach((callback) => {
      try {
        callback(payload);
      } catch (_) {
        // Ignore listener errors so one bad consumer does not break others.
      }
    });

    document.dispatchEvent(new CustomEvent("fiscus:realtime-event", { detail: payload }));
  }

  socket.on("auth:state", function (state) {
    notifyState(state);
  });

  socket.on("app:event", function (payload) {
    notifyAppEvent(payload);
  });

  window.FiscusRealtime = {
    isConnected: function () {
      return Boolean(socket.connected);
    },
    onState: function (callback) {
      if (typeof callback !== "function") {
        return function () {};
      }

      listeners.state.add(callback);
      return function () {
        listeners.state.delete(callback);
      };
    },
    onAppEvent: function (callback) {
      if (typeof callback !== "function") {
        return function () {};
      }

      listeners.appEvent.add(callback);
      return function () {
        listeners.appEvent.delete(callback);
      };
    },
    emitAuthEvent: function (type, details) {
      if (!type || !socket.connected) {
        return;
      }

      socket.emit("auth:event", {
        type: String(type),
        page: window.location.pathname || "",
        details: details || {}
      });
    },
    emitAppEvent: function (type, details) {
      if (!type || !socket.connected) {
        return;
      }

      socket.emit("app:event", {
        type: String(type),
        source: "client",
        page: window.location.pathname || "",
        details: details || {}
      });
    }
  };

  socket.on("connect", function () {
    document.dispatchEvent(new CustomEvent("fiscus:realtime-connection", { detail: { connected: true } }));
  });

  socket.on("disconnect", function () {
    document.dispatchEvent(new CustomEvent("fiscus:realtime-connection", { detail: { connected: false } }));
  });
})();
