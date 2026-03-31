function createVenueClient({ serviceAUrl, timeoutMs = 3000 }) {
  return {
    async getSlotById(slotId) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${serviceAUrl}/slots/${slotId}`, {
          method: "GET",
          signal: controller.signal
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Venue service request failed with ${response.status}`);
        }

        const payload = await response.json();
        return payload.data;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

module.exports = {
  createVenueClient
};
