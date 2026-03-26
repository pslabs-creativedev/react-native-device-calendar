module.exports = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: true,
  ignores: [
    (message) => {
      const trimmedMessage = message.trim();

      if (trimmedMessage.length === 0) {
        return false;
      }

      return !trimmedMessage.includes(':');
    },
  ],
};
