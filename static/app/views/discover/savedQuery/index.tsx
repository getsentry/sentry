import {memo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {AnimatePresence} from 'framer-motion';
import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Stack, Grid, type GridProps} from '@sentry/scraps/layout';

import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOverlay} from 'sentry/utils/useOverlay';
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

type SaveAsDropdownProps = {
  disabled: boolean;
  modifiedHandleCreateQuery: (
    e: React.MouseEvent | React.FormEvent<HTMLFormElement>
  ) => void;
  onChangeInput: (e: React.FormEvent<HTMLInputElement>) => void;
  queryName: string;
};

export function SaveAsDropdown({
  queryName,
  disabled,
  onChangeInput,
  modifiedHandleCreateQuery,
}: SaveAsDropdownProps) {
  const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay({
    position: 'bottom',
  });
  const theme = useTheme();

  return (
    <div>
      <Button
        {...triggerProps}
        size="sm"
        variant="primary"
        aria-label={t('Save as')}
        disabled={disabled}
      >
        {t('Save as')}
      </Button>
      <AnimatePresence>
        {isOpen && (
          <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
            <StyledOverlay arrowProps={arrowProps} animated>
              <FocusScope contain restoreFocus autoFocus>
                <form onSubmit={modifiedHandleCreateQuery}>
                  <Stack gap="md">
                    <Input
                      type="text"
                      name="query_name"
                      placeholder={t('Display name')}
                      value={queryName || ''}
                      onChange={onChangeInput}
                      disabled={disabled}
                    />
                    <SaveAsButton
                      type="submit"
                      onClick={modifiedHandleCreateQuery}
                      variant="primary"
                      disabled={disabled || !queryName}
                    >
                      {t('Save for Organization')}
                    </SaveAsButton>
                  </Stack>
                </form>
              </FocusScope>
            </StyledOverlay>
          </PositionWrapper>
        )}
      </AnimatePresence>
    </div>
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

const SavedQueryButtonGroup = memo(function SavedQueryButtonGroup({
  disabled = false,
  organization,
}: Props) {
  function renderButtonViewSaved(isDisabled: boolean) {
    return (
      <LinkButton
        onClick={() => {
          trackAnalytics('discover_v2.view_saved_queries', {organization});
        }}
        data-test-id="discover2-savedquery-button-view-saved"
        disabled={isDisabled}
        size="sm"
        icon={<IconStar isSolid />}
        to={getDiscoverQueriesUrl(organization)}
      >
        {t('Saved Queries')}
      </LinkButton>
    );
  }

  function renderQueryButton(renderFunc: (isDisabled: boolean) => React.ReactNode) {
    return (
      <Feature
        organization={organization}
        features="discover-query"
        overrideName="feature-disabled:discover-saved-query-create"
        renderDisabled={renderDisabled}
      >
        {({hasFeature}) => renderFunc(!hasFeature || disabled)}
      </Feature>
    );
  }

  return (
    <ResponsiveButtonBar>
      {renderQueryButton(isDisabled => renderButtonViewSaved(isDisabled))}
    </ResponsiveButtonBar>
  );
});

const ResponsiveButtonBar = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin-top: 0;
  }
`;

const StyledOverlay = styled(Overlay)`
  padding: ${p => p.theme.space.md};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;

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
