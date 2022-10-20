import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import DropdownLink from 'sentry/components/dropdownLink';
import EmptyMessage from 'sentry/components/emptyMessage';
import IntegrationExternalMappingForm from 'sentry/components/integrationExternalMappingForm';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd, IconArrow, IconEllipsis, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalActorSuggestion,
  Integration,
  Organization,
} from 'sentry/types';
import {getIntegrationIcon, isExternalActorMapping} from 'sentry/utils/integrationUtil';

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

type Props = AsyncComponent['props'] &
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

type State = AsyncComponent['state'] & {
  associationMappings: CodeOwnersAssociationMappings;
  newlyAssociatedMappings: ExternalActorMapping[];
};

class IntegrationExternalMappings extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      associationMappings: {},
      newlyAssociatedMappings: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
        return new Set<string>([...map, ...errors[errorKey]]);
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

  renderMappingOptions(mapping: ExternalActorMappingOrSuggestion) {
    const {type, onDelete, organization} = this.props;
    const canDelete = organization.access.includes('org:integrations');
    return isExternalActorMapping(mapping) ? (
      <Tooltip
        title={t(
          'You must be an organization owner, manager or admin to delete an external user mapping.'
        )}
        disabled={canDelete}
      >
        <DropdownLink
          anchorRight
          disabled={!canDelete}
          customTitle={
            <Button
              borderless
              size="sm"
              icon={<IconEllipsisVertical size="sm" />}
              aria-label={t('Actions')}
              data-test-id="mapping-option"
              disabled={!canDelete}
            />
          }
        >
          <MenuItemActionLink
            shouldConfirm
            message={t('Are you sure you want to remove this external %s mapping?', type)}
            onAction={() => onDelete(mapping)}
            aria-label={t('Delete External %s', capitalize(type))}
            data-test-id="delete-mapping-button"
          >
            <RedText>{t('Delete')}</RedText>
          </MenuItemActionLink>
        </DropdownLink>
      </Tooltip>
    ) : (
      <Tooltip
        title={t('This %s mapping suggestion was generated from a CODEOWNERS file', type)}
      >
        <Button
          disabled
          borderless
          size="sm"
          icon={<IconQuestion size="sm" />}
          aria-label={t(
            `This %s mapping suggestion was generated from a CODEOWNERS file`,
            type
          )}
          data-test-id="suggestion-option"
        />
      </Tooltip>
    );
  }

  renderBody() {
    const {integration, type, onCreate, pageLinks} = this.props;
    return (
      <Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <ExternalNameColumn header>
                {tct('External [type]', {type})}
              </ExternalNameColumn>
              <ArrowColumn>
                <IconArrow direction="right" size="md" />
              </ArrowColumn>
              <SentryNameColumn>{tct('Sentry [type]', {type})}</SentryNameColumn>
              <ButtonColumn>
                <AddButton
                  data-test-id="add-mapping-button"
                  onClick={() => onCreate()}
                  size="xs"
                  icon={<IconAdd size="xs" isCircled />}
                >
                  <ButtonText>{tct('Add [type] Mapping', {type})}</ButtonText>
                </AddButton>
              </ButtonColumn>
            </HeaderLayout>
          </PanelHeader>
          <PanelBody data-test-id="mapping-table">
            {!this.allMappings.length && (
              <EmptyMessage
                icon={getIntegrationIcon(integration.provider.key, 'lg')}
                data-test-id="empty-message"
              >
                {tct('Set up External [type] Mappings.', {type: capitalize(type)})}
              </EmptyMessage>
            )}
            {this.allMappings.map((mapping, index) => (
              <ConfigPanelItem key={index}>
                <Layout>
                  <ExternalNameColumn>
                    <StyledPluginIcon pluginId={integration.provider.key} size={19} />
                    <span>{mapping.externalName}</span>
                  </ExternalNameColumn>
                  <ArrowColumn>
                    <IconArrow direction="right" size="md" />
                  </ArrowColumn>
                  <SentryNameColumn>{this.renderMappingName(mapping)}</SentryNameColumn>
                  <ButtonColumn>{this.renderMappingOptions(mapping)}</ButtonColumn>
                </Layout>
              </ConfigPanelItem>
            ))}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={pageLinks} />
      </Fragment>
    );
  }
}

export default withRouter(IntegrationExternalMappings);

const AddButton = styled(Button)`
  text-transform: capitalize;
  height: inherit;
`;

const ButtonText = styled('div')`
  white-space: break-spaces;
`;

const Layout = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  padding: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 2.25fr 50px 2.75fr 100px;
  grid-template-areas: 'external-name arrow sentry-name button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  padding: 0 ${space(1)} 0 ${space(2)};
  text-transform: uppercase;
`;

const ConfigPanelItem = styled(PanelItem)`
  padding: 0 ${space(1)};
`;

const IconEllipsisVertical = styled(IconEllipsis)`
  transform: rotate(90deg);
`;

const StyledPluginIcon = styled(PluginIcon)`
  min-width: ${p => p.size}px;
  margin-right: ${space(2)};
`;

// Columns below
const Column = styled('span')`
  overflow: hidden;
  overflow-wrap: break-word;
`;

const ExternalNameColumn = styled(Column)<{header?: boolean}>`
  grid-area: external-name;
  display: flex;
  align-items: center;
  font-family: ${p => (p.header ? 'inherit' : p.theme.text.familyMono)};
`;

const ArrowColumn = styled(Column)`
  grid-area: arrow;
`;

const SentryNameColumn = styled(Column)`
  grid-area: sentry-name;
  overflow: visible;
`;

const ButtonColumn = styled(Column)`
  grid-area: button;
  text-align: right;
  overflow: visible;
`;

const RedText = styled('span')`
  color: ${p => p.theme.red300};
`;
