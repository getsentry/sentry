import {billingCalendarDateToTimestamp} from './billingCalendarDate';

it('projects valid billing days onto UTC midnight without accepting timestamps', () => {
  expect(billingCalendarDateToTimestamp('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
  expect(billingCalendarDateToTimestamp('2023-02-29')).toBeNaN();
  expect(billingCalendarDateToTimestamp('2024-02-29T00:00:00Z')).toBeNaN();
});
