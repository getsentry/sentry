import {OrganizationFixture} from 'sentry-fixture/organization';

import EventView from 'sentry/utils/discover/eventView';
import {getAllViews} from 'sentry/views/discover/results/data';
import {
  handleCreateQuery,
  handleDeleteQuery,
  handleUpdateQuery,
  handleUpdateQueryName,
} from 'sentry/views/discover/savedQuery/utils';

describe('SavedQueries API helpers', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();

  const errorsQuery = getAllViews(organization).find(
    view => view.name === 'Errors by Title'
  )!;
  const errorsView = EventView.fromSavedQuery(errorsQuery);
  errorsView.id = '1'; // set id manually as errorsView.id is undefined
  const yAxis = ['count()', 'failure_count()'];

  let mockCall: jest.Mock;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('handleCreateQuery', () => {
    beforeEach(() => {
      mockCall = MockApiClient.addMockResponse({
        method: 'POST',
        url: `/organizations/${organization.slug}/discover/saved/`,
        body: {data: {}, fromBody: {}},
      });
    });

    it('calls the correct API endpoint', async () => {
      const response = await handleCreateQuery(api, organization, errorsView, yAxis);
      expect(mockCall).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({yAxis}),
        })
      );
      expect(response).toEqual({data: {}, fromBody: {}});
    });
  });

  describe('handleUpdateQuery', () => {
    beforeEach(() => {
      mockCall = MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${organization.slug}/discover/saved/${errorsView.id}/`,
        body: {data: {}, fromBody: {}},
      });
    });

    it('calls the correct API endpoint', async () => {
      const response = await handleUpdateQuery(api, organization, errorsView, yAxis);
      expect(mockCall).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({yAxis}),
        })
      );
      expect(response).toEqual({data: {}, fromBody: {}});
    });
  });

  describe('handleUpdateQueryName', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        method: 'PUT',
        url: `/organizations/${organization.slug}/discover/saved/${errorsView.id}/`,
        body: {data: {}, fromBody: {}},
      });
    });

    it('calls the correct API endpoint', async () => {
      const response = await handleUpdateQueryName(api, organization, errorsView);
      expect(response).toEqual({data: {}, fromBody: {}});
    });
  });

  describe('handleDeleteQuery', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        method: 'DELETE',
        url: `/organizations/${organization.slug}/discover/saved/${errorsView.id}/`,
        body: {data: {}, fromBody: {}},
      });
    });

    it('calls the correct API endpoint', async () => {
      const response = await handleDeleteQuery(api, organization, errorsView);
      expect(response).toEqual({data: {}, fromBody: {}});
    });
  });
});
