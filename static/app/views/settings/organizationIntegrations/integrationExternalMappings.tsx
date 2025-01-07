import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd, IconArrow, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalActorSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {isExternalActorMapping} from 'sentry/utils/integrationUtil';
import {capitalize} from 'sentry/utils/string/capitalize';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';

type CodeOwnersAssociationMappings = {
  [projectSlug: string]: {
    associations: {
      [externalName: string]: string;
    };
    errors: {
      [errorKey: string]: string;
    };
  };
};

type Props = DeprecatedAsyncComponent['props'] &
  WithRouterProps &
  Pick<
    IntegrationExternalMappingForm['props'],
    | 'dataEndpoint'
    | 'getBaseFormEndpoint'
    | 'sentryNamesMapper'
    | 'onResults'
    | 'defaultOptions'
  > & {
    integration: Integration;
    mappings: ExternalActorMapping[];
    onCreate: (mapping?: ExternalActorMappingOrSuggestion) => void;
    onDelete: (mapping: ExternalActorMapping) => void;
    organization: Organization;
    type: 'team' | 'user';
    pageLinks?: string;
  };

type State = DeprecatedAsyncComponent['state'] & {
  associationMappings: CodeOwnersAssociationMappings;
  newlyAssociatedMappings: ExternalActorMapping[];
};

class IntegrationExternalMappings extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      associationMappings: {},
      newlyAssociatedMappings: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, integration} = this.props;
    return [
      [
        'associationMappings',
        `/organizations/${organization.slug}/codeowners-associations/`,
        {query: {provider: integration.provider.key}},
      ],
    ];
  }

  get isFirstPage(): boolean {
    const {cursor} = this.props.location.query;
    return cursor ? cursor?.split(':')[1] === '0' : true;
  }

  get unassociatedMappings(): ExternalActorSuggestion[] {
    const {type} = this.props;
    const {associationMappings} = this.state;
    const errorKey = `missing_external_${type}s`;
    const unassociatedMappings = Object.values(associationMappings).reduce(
      (map, {errors}) => {
        return new Set<string>([...map, ...errors[errorKey]!]);
      },
      new Set<string>()
    );
    return Array.from(unassociatedMappings).map(externalName => ({externalName}));
  }

  get allMappings(): ExternalActorMappingOrSuggestion[] {
    const {mappings} = this.props;
    if (!this.isFirstPage) {
      return mappings;
    }
    const {newlyAssociatedMappings} = this.state;
    const inlineMappings = this.unassociatedMappings.map(mapping => {
      // If this mapping has been changed, replace it with the new version from its change's response
      // The new version will be used in IntegrationExternalMappingForm to update the apiMethod and apiEndpoint
      const newlyAssociatedMapping = newlyAssociatedMappings.find(
        ({externalName}) => externalName === mapping.externalName
      );

      return newlyAssociatedMapping ?? mapping;
    });
    return [...inlineMappings, ...mappings];
  }

  renderMappingName(mapping: ExternalActorMappingOrSuggestion) {
    const {
      type,
      getBaseFormEndpoint,
      integration,
      dataEndpoint,
      sentryNamesMapper,
      onResults,
      defaultOptions,
    } = this.props;
    return (
      <IntegrationExternalMappingForm
        type={type}
        integration={integration}
        dataEndpoint={dataEndpoint}
        getBaseFormEndpoint={getBaseFormEndpoint}
        mapping={mapping}
        sentryNamesMapper={sentryNamesMapper}
        onResults={onResults}
        onSubmitSuccess={(newMapping: ExternalActorMapping) => {
          this.setState({
            newlyAssociatedMappings: [
              ...this.state.newlyAssociatedMappings.filter(
                map => map.externalName !== newMapping.externalName
              ),
              newMapping as ExternalActorMapping,
            ],
          });
        }}
        isInline
        defaultOptions={defaultOptions}
      />
    );
  }

  renderMappingActions(mapping: ExternalActorMappingOrSuggestion) {
    const {type, onDelete, organization} = this.props;
    const canDelete = organization.access.includes('org:integrations');
    return isExternalActorMapping(mapping) ? (
      <Confirm
        disabled={!canDelete}
        onConfirm={() => onDelete(mapping)}
        message={t('Are you sure you want to remove this external %s mapping?', type)}
      >
        <Button
          borderless
          size="sm"
          icon={<IconDelete size="sm" />}
          aria-label={t('Remove user mapping')}
          title={
            canDelete
              ? t('Remove user mapping')
              : t(
                  'You must be an organization owner, manager or admin to delete an external user mapping.'
                )
          }
        />
      </Confirm>
    ) : (
      <QuestionTooltip
        title={t('This %s mapping suggestion was generated from a CODEOWNERS file', type)}
        size="sm"
      />
    );
  }

  renderBody() {
    const {integration, type, onCreate, pageLinks} = this.props;
    return (
      <Fragment>
        <MappingTable
          data-test-id="mapping-table"
          isEmpty={!this.allMappings.length}
          emptyMessage={tct('Set up External [type] Mappings.', {type: capitalize(type)})}
          headers={[
            tct('External [type]', {type}),
            <IconArrow key="arrow" direction="right" size="sm" />,
            tct('Sentry [type]', {type}),
            <AddButton
              key="delete-button"
              data-test-id="add-mapping-button"
              onClick={() => onCreate()}
              size="xs"
              icon={<IconAdd isCircled />}
            >
              {tct('Add [type] Mapping', {type})}
            </AddButton>,
          ]}
        >
          {this.allMappings.map((mapping, index) => (
            <Fragment key={index}>
              <ExternalNameColumn>
                <StyledPluginIcon pluginId={integration.provider.key} size={19} />
                <span>{mapping.externalName}</span>
              </ExternalNameColumn>
              <div>
                <IconArrow direction="right" size="sm" color="gray300" />
              </div>
              <ExternalForm>{this.renderMappingName(mapping)}</ExternalForm>
              <div>{this.renderMappingActions(mapping)}</div>
            </Fragment>
          ))}
        </MappingTable>
        <Pagination pageLinks={pageLinks} />
      </Fragment>
    );
  }
}

export default withSentryRouter(IntegrationExternalMappings);

const MappingTable = styled(PanelTable)`
  overflow: visible;
  grid-template-columns: 1fr max-content 1fr 66px;

  ${p =>
    !p.isEmpty
      ? `
  > :nth-child(n + 5) {
    display: flex;
    align-items: center;
    padding: ${space(1.5)} ${space(2)};
  }

  > * {
    padding: ${space(1)} ${space(2)};
  }
`
      : `
  > :not(:nth-child(n + 5)) {
    padding: ${space(1)} ${space(2)};
  }`}

  > :nth-child(4n) {
    padding-right: ${space(1)};
    justify-content: end;
  }
`;

const StyledPluginIcon = styled(PluginIcon)`
  min-width: ${p => p.size}px;
  margin-right: ${space(2)};
`;

const ExternalNameColumn = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const AddButton = styled(Button)`
  align-self: end;
`;

const ExternalForm = styled('div')`
  width: 100%;
`;
