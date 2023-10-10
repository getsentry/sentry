import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalUser,
  Integration,
  Member,
  Organization,
} from 'sentry/types';
import {sentryNameToOption} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';
import IntegrationExternalMappings from './integrationExternalMappings';

type Props = DeprecatedAsyncComponent['props'] &
  WithRouterProps & {
    integration: Integration;
    organization: Organization;
  };

type State = DeprecatedAsyncComponent['state'] & {
  initialResults: Member[];
  members: (Member & {externalUsers: ExternalUser[]})[];
};

class IntegrationExternalUserMappings extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      // We paginate on this query, since we're filtering by hasExternalUsers:true
      [
        'members',
        `/organizations/${organization.slug}/members/`,
        {query: {query: 'hasExternalUsers:true', expand: 'externalUsers'}},
      ],
      // We use this query as defaultOptions to reduce identical API calls
      ['initialResults', `/organizations/${organization.slug}/members/`],
    ];
  }

  handleDelete = async (mapping: ExternalActorMapping) => {
    const {organization} = this.props;
    try {
      await this.api.requestPromise(
        `/organizations/${organization.slug}/external-users/${mapping.id}/`,
        {
          method: 'DELETE',
        }
      );
      // remove config and update state
      addSuccessMessage(t('Deletion successful'));
      this.fetchData();
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  handleSubmitSuccess = () => {
    // Don't bother updating state. The info is in array of objects for each object in another array of objects.
    // Easier and less error-prone to re-fetch the data and re-calculate state.
    this.fetchData();
  };

  get mappings() {
    const {integration} = this.props;
    const {members} = this.state;
    const externalUserMappings = members.reduce<ExternalActorMapping[]>((acc, member) => {
      const {externalUsers, user} = member;

      acc.push(
        ...externalUsers
          .filter(externalUser => externalUser.provider === integration.provider.key)
          .map(externalUser => ({...externalUser, sentryName: user?.name ?? member.name}))
      );
      return acc;
    }, []);
    return externalUserMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  get dataEndpoint() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/members/`;
  }

  get baseFormEndpoint() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/external-users/`;
  }

  get defaultUserOptions() {
    const {initialResults} = this.state;
    return this.sentryNamesMapper(initialResults).map(sentryNameToOption);
  }

  sentryNamesMapper(members: Member[]) {
    return members
      .filter(member => member.user)
      .map(({user, email, name}) => {
        const label = email !== name ? `${name} - ${email}` : `${email}`;
        return {id: user?.id!, name: label};
      });
  }

  openModal = (mapping?: ExternalActorMappingOrSuggestion) => {
    const {integration} = this.props;
    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure External User Mapping')}</Header>
        <Body>
          <IntegrationExternalMappingForm
            type="user"
            integration={integration}
            dataEndpoint={this.dataEndpoint}
            getBaseFormEndpoint={() => this.baseFormEndpoint}
            defaultOptions={this.defaultUserOptions}
            mapping={mapping}
            sentryNamesMapper={this.sentryNamesMapper}
            onCancel={closeModal}
            onSubmitSuccess={() => {
              this.handleSubmitSuccess();
              closeModal();
            }}
          />
        </Body>
      </Fragment>
    ));
  };

  renderBody() {
    const {integration, organization} = this.props;
    const {membersPageLinks} = this.state;
    return (
      <Fragment>
        <IntegrationExternalMappings
          type="user"
          integration={integration}
          organization={organization}
          mappings={this.mappings}
          dataEndpoint={this.dataEndpoint}
          getBaseFormEndpoint={() => this.baseFormEndpoint}
          defaultOptions={this.defaultUserOptions}
          sentryNamesMapper={this.sentryNamesMapper}
          onCreate={this.openModal}
          onDelete={this.handleDelete}
          pageLinks={membersPageLinks}
        />
      </Fragment>
    );
  }
}

export default withSentryRouter(withOrganization(IntegrationExternalUserMappings));
