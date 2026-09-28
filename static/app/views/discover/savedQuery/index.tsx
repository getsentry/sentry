import {memo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
import type {SaveQueryModalProps} from 'sentry/components/modals/explore/saveQueryModal';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';
import {withApi} from 'sentry/utils/withApi';
import {withProjects} from 'sentry/utils/withProjects';
import {TraceItemDataset} from 'sentry/views/explore/types';

const renderDisabled = (p: any) => (
  <Hovercard
    body={
      <FeatureDisabled
        features={p.features}
        hideHelpToggle
        message={t('Discover queries are disabled')}
        featureName={t('Discover queries')}
      />
    }
  >
    {p.children(p)}
  </Hovercard>
);

type SaveAsButtonProps = {
  disabled: boolean;
  onSave: SaveQueryModalProps['saveQuery'];
  organization: Organization;
};

export function SaveAsButton({disabled, onSave, organization}: SaveAsButtonProps) {
  return (
    <Button
      size="sm"
      variant="primary"
      aria-label={t('Save as')}
      disabled={disabled}
      onClick={() =>
        openSaveQueryModal({
          organization,
          saveQuery: onSave,
          traceItemDataset: TraceItemDataset.ERRORS,
        })
      }
    >
      {t('Save as')}
    </Button>
  );
}

type Props = {
  api: Client;

  eventView: EventView;
  /**
   * DO NOT USE `Location` TO GENERATE `EventView` IN THIS COMPONENT.
   *
   * In this component, state is generated from EventView and SavedQueriesStore.
   * Using Location to rebuild EventView will break the tests. `Location` is
   * passed down only because it is needed for navigation.
   */
  location: Location;
  navigate: ReactRouter3Navigate;
  organization: Organization;
  projects: Project[];
  queryDataLoading: boolean;
  savedQuery: SavedQuery | undefined;
  setHomepageQuery: (homepageQuery?: SavedQuery) => void;
  setSavedQuery: (savedQuery: SavedQuery) => void;
  updateCallback: () => void;
  yAxis: string[];
  disabled?: boolean;
  homepageQuery?: SavedQuery;
  isHomepage?: boolean;
};

const SavedQueryButtonGroup = memo(function SavedQueryButtonGroupImpl({
  disabled = false,
  organization,
}: Props) {
  return (
    <Grid flow="column" align="center" gap="md">
      <Feature
        organization={organization}
        features="discover-query"
        overrideName="feature-disabled:discover-saved-query-create"
        renderDisabled={renderDisabled}
      >
        {({hasFeature}) => (
          <LinkButton
            onClick={() => {
              trackAnalytics('discover_v2.view_saved_queries', {organization});
            }}
            data-test-id="discover2-savedquery-button-view-saved"
            disabled={!hasFeature || disabled}
            size="sm"
            icon={<IconStar isSolid />}
            to={getDiscoverQueriesUrl(organization)}
          >
            {t('Saved Queries')}
          </LinkButton>
        )}
      </Feature>
    </Grid>
  );
});

export const IconUpdate = styled('div')`
  display: inline-block;
  width: 10px;
  height: 10px;

  margin-right: ${p => p.theme.space.sm};
  border-radius: 5px;
  background-color: ${p => p.theme.colors.yellow400};
`;

function SavedQueryButtonGroupWithNavigate(props: Omit<Props, 'navigate'>) {
  const navigate = useNavigate();
  return <SavedQueryButtonGroup {...props} navigate={navigate} />;
}

export default withProjects(withApi(SavedQueryButtonGroupWithNavigate));
