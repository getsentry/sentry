import {memo, useState} from 'react';
import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
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

type SaveQueryModalProps = ModalRenderProps & {
  onSave: (queryName: string) => Promise<void>;
};

export function SaveQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSave,
}: SaveQueryModalProps) {
  const [queryName, setQueryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!queryName || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(queryName);
      closeModal();
    } catch {
      // handleCreateQuery already shows an error message
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Header closeButton>
        <h4>{t('New Query')}</h4>
      </Header>
      <Body>
        <Input
          autoFocus
          type="text"
          name="query_name"
          placeholder={t('Display name')}
          value={queryName}
          onChange={e => setQueryName(e.currentTarget.value)}
        />
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!queryName || isSaving}>
            {t('Save for Organization')}
          </Button>
        </Flex>
      </Footer>
    </form>
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

function SavedQueryButtonGroupWithNavigate(props: Omit<Props, 'navigate'>) {
  const navigate = useNavigate();
  return <SavedQueryButtonGroup {...props} navigate={navigate} />;
}

export default withProjects(withApi(SavedQueryButtonGroupWithNavigate));
