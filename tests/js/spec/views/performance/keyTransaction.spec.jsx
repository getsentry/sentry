import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mount, mountWithTheme} from 'sentry-test/enzyme';

import EventView from 'app/utils/discover/eventView';
import KeyTransactionQuery from 'app/views/performance/keyTransactionQuery';
import KeyTransactionAction from 'app/views/performance/keyTransactionAction';
import KeyTransactionButton from 'app/views/performance/transactionSummary/keyTransactionButton';

describe('KeyTransaction', function() {
  const features = ['discover-basic', 'performance-view'];
  const project = TestStubs.Project();
  const organization = TestStubs.Organization({
    features,
    projects: [project],
    apdexThreshold: 400,
  });
  const {routerContext} = initializeOrg({
    organization,
    router: {
      location: {
        query: {},
      },
    },
  });

  let getKeyTransactionTrueMock;
  let getKeyTransactionFalseMock;
  let getKeyTransactionErrorMock;
  let setKeyTransactionTrueMock;
  let setKeyTransactionFalseMock;
  let renderMock = jest.fn(() => null);

  beforeEach(async function() {
    renderMock.mockClear();
    MockApiClient.clearMockResponses();
    getKeyTransactionTrueMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/${organization.slug}/is-key-transactions/`,
        body: {isKey: true},
      },
      {
        predicate: (_, options) => options?.query?.transaction === '/true',
      }
    );
    getKeyTransactionFalseMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/${organization.slug}/is-key-transactions/`,
        body: {isKey: false},
      },
      {
        predicate: (_, options) => options?.query?.transaction === '/false',
      }
    );
    getKeyTransactionErrorMock = MockApiClient.addMockResponse(
      {
        url: `/organizations/${organization.slug}/is-key-transactions/`,
        statusCode: 400,
        body: {detail: 'im an error'},
      },
      {
        predicate: (_, options) => options?.query?.transaction === '/error',
      }
    );
    setKeyTransactionTrueMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/key-transactions/`,
    });
    setKeyTransactionFalseMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/organizations/${organization.slug}/key-transactions/`,
    });
  });

  describe('KeyTransactionAction', function() {
    it('should render mark as key transaction', async function() {
      const wrapper = mountWithTheme(
        <KeyTransactionAction
          projectID={project.id}
          organization={organization}
          transactionName="/false"
        />
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('button').text()).toEqual('Mark as key transaction');
      wrapper.find('button').simulate('click');
      expect(wrapper.find('button').text()).toEqual('Unmark as key transaction');
    });

    it('should render unmark as key transaction', async function() {
      const wrapper = mountWithTheme(
        <KeyTransactionAction
          projectID={project.id}
          organization={organization}
          transactionName="/true"
        />
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('button').text()).toEqual('Unmark as key transaction');
      wrapper.find('button').simulate('click');
      expect(wrapper.find('button').text()).toEqual('Mark as key transaction');
    });
  });

  describe('KeyTransactionButton', function() {
    const eventView = EventView.fromSavedQuery({
      version: 2,
      name: 'Event',
      query: '',
      fields: ['count()'],
      projects: [project.id],
    });

    it('should render once it receives a good response', async function() {
      const wrapper = mountWithTheme(
        <KeyTransactionButton
          eventView={eventView}
          organization={organization}
          transactionName="/true"
        />
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('button').exists()).toBeTruthy();
    });

    it('should not render if it receives an error response', async function() {
      const wrapper = mountWithTheme(
        <KeyTransactionButton
          eventView={eventView}
          organization={organization}
          transactionName="/error"
        />
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('button').exists()).toBeFalsy();
    });
  });

  describe('KeyTransactionQuery', function() {
    it('fetches data on mount', async function() {
      const wrapper = mount(
        <KeyTransactionQuery
          projectID={project.id}
          organization={organization}
          transactionName="/true"
        >
          {renderMock}
        </KeyTransactionQuery>,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(getKeyTransactionTrueMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: null,
          isKeyTransaction: true,
        })
      );
    });

    it('passes errors down', async function() {
      const wrapper = mount(
        <KeyTransactionQuery
          projectID={project.id}
          organization={organization}
          transactionName="/error"
        >
          {renderMock}
        </KeyTransactionQuery>,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(getKeyTransactionErrorMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: 'im an error',
        })
      );
    });

    it('toggles key transaction from false to true', async function() {
      renderMock = jest.fn(({toggleKeyTransaction}) => {
        return <button onClick={toggleKeyTransaction}>click me</button>;
      });
      const wrapper = mount(
        <KeyTransactionQuery
          projectID={project.id}
          organization={organization}
          transactionName="/false"
        >
          {renderMock}
        </KeyTransactionQuery>,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(getKeyTransactionFalseMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: null,
          isKeyTransaction: false,
        })
      );

      // this sends a POST to set the transaction as key
      wrapper.find('button').simulate('click');
      await tick();
      wrapper.update();

      expect(setKeyTransactionTrueMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: null,
          isKeyTransaction: true,
        })
      );
    });

    it('toggles key transaction from true to false', async function() {
      renderMock = jest.fn(({toggleKeyTransaction}) => {
        return <button onClick={toggleKeyTransaction}>click me</button>;
      });
      const wrapper = mount(
        <KeyTransactionQuery
          projectID={project.id}
          organization={organization}
          transactionName="/true"
        >
          {renderMock}
        </KeyTransactionQuery>,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(getKeyTransactionTrueMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: null,
          isKeyTransaction: true,
        })
      );

      // this sends a DELETE to unset the transaction as key
      wrapper.find('button').simulate('click');
      await tick();
      wrapper.update();

      expect(setKeyTransactionFalseMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          error: null,
          isKeyTransaction: false,
        })
      );
    });
  });
});
