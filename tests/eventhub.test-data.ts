export const eventHub = {
  baseURL: 'https://eventhub.rahulshettyacademy.com',
  password: 'Test@12345',
  attendee: {
    fullName: 'Amit Meta',
    phone: '9876543210',
  },
} as const;

export function createBookingTestData(runId: number) {
  return {
    runId,
    email: `automation_${runId}@example.com`,
  };
}
