import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import {isExternalActorMapping} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

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

type Props = Pick<
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
  type: 'team' | 'user';
  pageLinks?: string;
};

type LocationQuery = {
  cursor?: string;
};

function IntegrationExternalMappings(props: Props) {
  const {
    integration,
    type,
    mappings,
    pageLinks,
    dataEndpoint,
    defaultOptions,
    onCreate,
    onResults,
    onDelete,
    getBaseFormEndpoint,
    sentryNamesMapper,
  } = props;

  const [newlyAssociatedMappings, setNewlyAssociatedMappings] = useState<
    ExternalActorMapping[]
  >([]);

  const organization = useOrganization();
  const location = useLocation<LocationQuery>();
  const {cursor} = location.query;
  const isFirstPage = cursor ? cursor.split(':')[1] === '0' : true;

  const {
    data: associationMappings,
    isPending,
    isError,
    refetch,
  } = useApiQuery<CodeOwnersAssociationMappings>(
    [
      `/organizations/${organization.slug}/codeowners-associations/`,
      {query: {provider: integration.provider.key}},
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const unassociatedMappings = (): ExternalActorSuggestion[] => {
    const errorKey = `missing_external_${type}s`;
    const unassociatedMappingsSet = Object.values(associationMappings).reduce(
      (map, {errors}) => {
        return new Set<string>([...map, ...errors[errorKey]!]);
      },
      new Set<string>()
    );
    return Array.from(unassociatedMappingsSet).map(externalName => ({externalName}));
  };

  const allMappings = (): ExternalActorMappingOrSuggestion[] => {
    if (!isFirstPage) {
      return mappings;
    }
    const inlineMappings = unassociatedMappings().map(mapping => {
      // If this mapping has been changed, replace it with the new version from its change's response
      // The new version will be used in IntegrationExternalMappingForm to update the apiMethod and apiEndpoint
      const newlyAssociatedMapping = newlyAssociatedMappings.find(
        ({externalName}) => externalName === mapping.externalName
      );

      return newlyAssociatedMapping ?? mapping;
    });
    return [...inlineMappings, ...mappings];
  };

  const renderMappingName = (mapping: ExternalActorMappingOrSuggestion) => {
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
          setNewlyAssociatedMappings([
            ...newlyAssociatedMappings.filter(
              map => map.externalName !== newMapping.externalName
            ),
            newMapping,
          ]);
        }}
        isInline
        defaultOptions={defaultOptions}
      />
    );
  };

  const renderMappingActions = (mapping: ExternalActorMappingOrSuggestion) => {
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
  };

  return (
    <Fragment>
      <MappingTable
        data-test-id="mapping-table"
        isEmpty={!allMappings().length}
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
        {allMappings().map((mapping, index) => (
          <Fragment key={index}>
            <ExternalNameColumn>
              <StyledPluginIcon pluginId={integration.provider.key} size={19} />
              <span>{mapping.externalName}</span>
            </ExternalNameColumn>
            <div>
              <IconArrow direction="right" size="sm" color="gray300" />
            </div>
            <ExternalForm>{renderMappingName(mapping)}</ExternalForm>
            <div>{renderMappingActions(mapping)}</div>
          </Fragment>
        ))}
      </MappingTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export default IntegrationExternalMappings;

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
