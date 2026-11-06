import {enqueueDashboardWrite} from './useDashboardQueryPriority';

describe('enqueueDashboardWrite', () => {
  it('runs a dashboard save after the priority save already in flight', async () => {
    let releasePrioritySave = () => {};
    const prioritySave = new Promise<void>(resolve => {
      releasePrioritySave = resolve;
    });
    const order: string[] = [];

    const priorityWrite = enqueueDashboardWrite(async () => {
      order.push('priority-start');
      await prioritySave;
      order.push('priority-end');
    });
    let dashboardStarted = false;
    const dashboardWrite = enqueueDashboardWrite(() => {
      dashboardStarted = true;
      order.push('dashboard');
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(order).toEqual(['priority-start']);
    expect(dashboardStarted).toBe(false);

    releasePrioritySave();
    await priorityWrite;
    await dashboardWrite;

    expect(order).toEqual(['priority-start', 'priority-end', 'dashboard']);
  });

  it('runs the next save after the previous one fails', async () => {
    const order: string[] = [];

    const failedWrite = enqueueDashboardWrite(() => {
      order.push('failed');
      return Promise.reject(new Error('save failed'));
    });
    const nextWrite = enqueueDashboardWrite(() => {
      order.push('next');
      return Promise.resolve();
    });

    await expect(failedWrite).rejects.toThrow('save failed');
    await nextWrite;
    expect(order).toEqual(['failed', 'next']);
  });
});
