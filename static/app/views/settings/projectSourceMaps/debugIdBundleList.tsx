import {Link} from 'react-router';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconList} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {DebugIdBundle, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {DebugIdBundleDeleteButton} from 'sentry/views/settings/projectSourceMaps/debugIdBundleDeleteButton';
import {DebugIdBundleDetails} from 'sentry/views/settings/projectSourceMaps/debugIdBundleDetails';

interface DebugIdBundleListProps {
  emptyMessage: React.ReactNode;
  isLoading: boolean;
  onDelete: (bundleId: string) => void;
  project: Project;
  debugIdBundles?: DebugIdBundle[];
}

export function DebugIdBundleList({
  isLoading,
  debugIdBundles,
  emptyMessage,
  onDelete,
  project,
}: DebugIdBundleListProps) {
  const organization = useOrganization();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!debugIdBundles || debugIdBundles.length === 0) {
    return <EmptyMessage>{emptyMessage}</EmptyMessage>;
  }
  return (
    <List>
      {debugIdBundles.map(debugIdBundle => (
        <Item key={debugIdBundle.bundleId}>
          <ItemHeader>
            <ItemTitle
              to={`/settings/${organization.slug}/projects/${
                project.slug
              }/source-maps/artifact-bundles/${encodeURIComponent(
                debugIdBundle.bundleId
              )}`}
            >
              <IconList /> {debugIdBundle.bundleId}
            </ItemTitle>
            <DebugIdBundleDeleteButton
              onDelete={() => onDelete(debugIdBundle.bundleId)}
            />
          </ItemHeader>
          <ItemContent>
            <DebugIdBundleDetails debugIdBundle={debugIdBundle} />
          </ItemContent>
        </Item>
      ))}
    </List>
  );
}

const List = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
`;

const Item = styled(Panel)`
  margin: 0;
`;

const ItemHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeMedium};
  border-bottom: 1px solid ${p => p.theme.border};
  line-height: 1;
  padding: ${space(1)} ${space(2)};
`;

const ItemTitle = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ItemContent = styled('div')`
  padding: ${space(1)} ${space(2)};
`;
