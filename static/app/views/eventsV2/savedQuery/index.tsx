import {Fragment, PureComponent} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {AnimatePresence} from 'framer-motion';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Banner from 'sentry/components/banner';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import FeatureBadge from 'sentry/components/featureBadge';
import {Hovercard} from 'sentry/components/hovercard';
import InputControl from 'sentry/components/input';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconBookmark, IconDelete, IconEllipsis, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SavedQuery} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';
import useOverlay from 'sentry/utils/useOverlay';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import {handleAddQueryToDashboard} from 'sentry/views/eventsV2/utils';

import {DEFAULT_EVENT_VIEW} from '../data';

import {
  handleCreateQuery,
  handleDeleteQuery,
  handleResetHomepageQuery,
  handleUpdateHomepageQuery,
  handleUpdateQuery,
} from './utils';

const renderDisabled = p => (
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
  modifiedHandleCreateQuery: (e: React.MouseEvent<Element>) => void;
  onChangeInput: (e: React.FormEvent<HTMLInputElement>) => void;
  queryName: string;
};

function SaveAsDropdown({
  queryName,
  disabled,
  onChangeInput,
  modifiedHandleCreateQuery,
}: SaveAsDropdownProps) {
  const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay();
  const theme = useTheme();

  return (
    <div>
      <Button
        {...triggerProps}
        size="sm"
        icon={<IconStar />}
        aria-label={t('Save as')}
        disabled={disabled}
      >
        {`${t('Save as')}\u2026`}
      </Button>
      <AnimatePresence>
        {isOpen && (
          <FocusScope contain restoreFocus autoFocus>
            <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
              <StyledOverlay arrowProps={arrowProps} animated>
                <SaveAsInput
                  type="text"
                  name="query_name"
                  placeholder={t('Display name')}
                  value={queryName || ''}
                  onChange={onChangeInput}
                  disabled={disabled}
                />
                <SaveAsButton
                  onClick={modifiedHandleCreateQuery}
                  priority="primary"
                  disabled={disabled || !queryName}
                >
                  {t('Save for Org')}
                </SaveAsButton>
              </StyledOverlay>
            </PositionWrapper>
          </FocusScope>
        )}
      </AnimatePresence>
    </div>
  );
}

type DefaultProps = {
  disabled: boolean;
};

type Props = DefaultProps & {
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
  organization: Organization;
  projects: Project[];
  queryDataLoading: boolean;
  router: InjectedRouter;
  savedQuery: SavedQuery | undefined;
  setHomepageQuery: (homepageQuery?: SavedQuery) => void;
  setSavedQuery: (savedQuery: SavedQuery) => void;
  updateCallback: () => void;
  yAxis: string[];
  homepageQuery?: SavedQuery;
  isHomepage?: boolean;
};

type State = {
  isEditingQuery: boolean;
  isNewQuery: boolean;

  queryName: string;
};

class SavedQueryButtonGroup extends PureComponent<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const {eventView: nextEventView, savedQuery, queryDataLoading, yAxis} = nextProps;

    // For a new unsaved query
    if (!savedQuery) {
      return {
        isNewQuery: true,
        isEditingQuery: false,
        queryName: prevState.queryName || '',
      };
    }

    if (queryDataLoading) {
      return prevState;
    }

    const savedEventView = EventView.fromSavedQuery(savedQuery);

    // Switching from a SavedQuery to another SavedQuery
    if (savedEventView.id !== nextEventView.id) {
      return {
        isNewQuery: false,
        isEditingQuery: false,
        queryName: '',
      };
    }

    // For modifying a SavedQuery
    const isEqualQuery = nextEventView.isEqualTo(savedEventView);
    // undefined saved yAxis defaults to count() and string values are converted to array
    const isEqualYAxis = isEqual(
      yAxis,
      !savedQuery.yAxis
        ? ['count()']
        : typeof savedQuery.yAxis === 'string'
        ? [savedQuery.yAxis]
        : savedQuery.yAxis
    );
    return {
      isNewQuery: false,
      isEditingQuery: !isEqualQuery || !isEqualYAxis,

      // HACK(leedongwei): See comment at SavedQueryButtonGroup.onFocusInput
      queryName: prevState.queryName || '',
    };
  }

  /**
   * Stop propagation for the input and container so people can interact with
   * the inputs in the dropdown.
   */
  static stopEventPropagation = (event: React.MouseEvent) => {
    const capturedElements = ['LI', 'INPUT'];

    if (
      event.target instanceof Element &&
      capturedElements.includes(event.target.nodeName)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  static defaultProps: DefaultProps = {
    disabled: false,
  };

  state: State = {
    isNewQuery: true,
    isEditingQuery: false,

    queryName: '',
  };

  onChangeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    this.setState({queryName: target.value});
  };

  /**
   * There are two ways to create a query
   * 1) Creating a query from scratch and saving it
   * 2) Modifying an existing query and saving it
   */
  handleCreateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, eventView, yAxis} = this.props;

    if (!this.state.queryName) {
      return;
    }

    const nextEventView = eventView.clone();
    nextEventView.name = this.state.queryName;

    // Checks if "Save as" button is clicked from a clean state, or it is
    // clicked while modifying an existing query
    const isNewQuery = !eventView.id;

    handleCreateQuery(api, organization, nextEventView, yAxis, isNewQuery).then(
      (savedQuery: SavedQuery) => {
        const view = EventView.fromSavedQuery(savedQuery);

        Banner.dismiss('discover');
        this.setState({queryName: ''});
        browserHistory.push(view.getResultsViewUrlTarget(organization.slug));
      }
    );
  };

  handleUpdateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, eventView, updateCallback, yAxis, setSavedQuery} =
      this.props;

    handleUpdateQuery(api, organization, eventView, yAxis).then(
      (savedQuery: SavedQuery) => {
        const view = EventView.fromSavedQuery(savedQuery);
        setSavedQuery(savedQuery);
        this.setState({queryName: ''});
        browserHistory.push(view.getResultsViewShortUrlTarget(organization.slug));
        updateCallback();
      }
    );
  };

  handleDeleteQuery = (event?: React.MouseEvent<Element>) => {
    event?.preventDefault();
    event?.stopPropagation();

    const {api, organization, eventView} = this.props;

    handleDeleteQuery(api, organization, eventView).then(() => {
      browserHistory.push({
        pathname: getDiscoverQueriesUrl(organization),
        query: {},
      });
    });
  };

  handleCreateAlertSuccess = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.create_alert_clicked',
      eventName: 'Discoverv2: Create alert clicked',
      status: 'success',
      organization_id: organization.id,
      url: window.location.href,
    });
  };

  renderButtonViewSaved(disabled: boolean) {
    const {organization} = this.props;
    return (
      <Button
        onClick={() => {
          trackAdvancedAnalyticsEvent('discover_v2.view_saved_queries', {organization});
        }}
        data-test-id="discover2-savedquery-button-view-saved"
        disabled={disabled}
        size="sm"
        icon={<IconStar isSolid />}
        to={getDiscoverQueriesUrl(organization)}
      >
        {t('Saved Queries')}
      </Button>
    );
  }

  renderButtonSaveAs(disabled: boolean) {
    const {queryName} = this.state;
    return (
      <SaveAsDropdown
        queryName={queryName}
        onChangeInput={this.onChangeInput}
        modifiedHandleCreateQuery={this.handleCreateQuery}
        disabled={disabled}
      />
    );
  }

  renderButtonSave(disabled: boolean) {
    const {isNewQuery, isEditingQuery} = this.state;
    const {organization} = this.props;

    // TODO(nar): Remove this button when Discover homepage is released
    // Existing query that hasn't been modified.
    if (!isNewQuery && !isEditingQuery) {
      if (organization.features.includes('discover-query-builder-as-landing-page')) {
        return null;
      }
      return (
        <Button
          icon={<IconStar color="yellow100" isSolid size="sm" />}
          size="sm"
          disabled
          data-test-id="discover2-savedquery-button-saved"
        >
          {t('Saved for Org')}
        </Button>
      );
    }
    // Existing query with edits, show save and save as.
    if (!isNewQuery && isEditingQuery) {
      return (
        <Fragment>
          <Button
            onClick={this.handleUpdateQuery}
            data-test-id="discover2-savedquery-button-update"
            disabled={disabled}
            size="sm"
          >
            <IconUpdate />
            {t('Save Changes')}
          </Button>
          {this.renderButtonSaveAs(disabled)}
        </Fragment>
      );
    }

    // Is a new query enable saveas
    return this.renderButtonSaveAs(disabled);
  }

  renderButtonDelete(disabled: boolean) {
    const {isNewQuery} = this.state;

    if (isNewQuery) {
      return null;
    }

    return (
      <Button
        data-test-id="discover2-savedquery-button-delete"
        onClick={this.handleDeleteQuery}
        disabled={disabled}
        size="sm"
        icon={<IconDelete />}
        aria-label={t('Delete')}
      />
    );
  }

  renderButtonCreateAlert() {
    const {eventView, organization, projects} = this.props;

    return (
      <GuideAnchor target="create_alert_from_discover">
        <CreateAlertFromViewButton
          eventView={eventView}
          organization={organization}
          projects={projects}
          onClick={this.handleCreateAlertSuccess}
          referrer="discover"
          size="sm"
          aria-label={t('Create Alert')}
          data-test-id="discover2-create-from-discover"
        />
      </GuideAnchor>
    );
  }

  renderButtonAddToDashboard() {
    const {organization, eventView, savedQuery, yAxis, router, location} = this.props;
    return (
      <Button
        key="add-dashboard-widget-from-discover"
        data-test-id="add-dashboard-widget-from-discover"
        size="sm"
        onClick={() =>
          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            query: savedQuery,
            yAxis,
            router,
          })
        }
      >
        {t('Add to Dashboard')}
      </Button>
    );
  }

  renderSaveAsHomepage(disabled: boolean) {
    const {
      api,
      organization,
      eventView,
      location,
      isHomepage,
      setHomepageQuery,
      homepageQuery,
      queryDataLoading,
    } = this.props;
    const buttonDisabled = disabled || queryDataLoading;
    const analyticsEventSource = isHomepage
      ? 'homepage'
      : eventView.id
      ? 'saved-query'
      : 'prebuilt-query';
    if (
      homepageQuery &&
      eventView.isEqualTo(EventView.fromSavedQuery(homepageQuery), ['id', 'name'])
    ) {
      return (
        <Button
          key="reset-discover-homepage"
          data-test-id="reset-discover-homepage"
          onClick={async () => {
            await handleResetHomepageQuery(api, organization);
            trackAdvancedAnalyticsEvent('discover_v2.remove_default', {
              organization,
              source: analyticsEventSource,
            });
            setHomepageQuery(undefined);
            if (isHomepage) {
              const nextEventView = EventView.fromNewQueryWithLocation(
                DEFAULT_EVENT_VIEW,
                location
              );
              browserHistory.push({
                pathname: location.pathname,
                query: nextEventView.generateQueryStringObject(),
              });
            }
          }}
          size="sm"
          icon={<IconBookmark isSolid />}
          disabled={buttonDisabled}
        >
          {t('Remove Default')}
          <FeatureBadge type="beta" />
        </Button>
      );
    }

    return (
      <Button
        key="set-as-default"
        data-test-id="set-as-default"
        onClick={async () => {
          const updatedHomepageQuery = await handleUpdateHomepageQuery(
            api,
            organization,
            eventView.toNewQuery()
          );
          trackAdvancedAnalyticsEvent('discover_v2.set_as_default', {
            organization,
            source: analyticsEventSource,
          });
          if (updatedHomepageQuery) {
            setHomepageQuery(updatedHomepageQuery);
          }
        }}
        size="sm"
        icon={<IconBookmark />}
        disabled={buttonDisabled}
      >
        {t('Set as Default')}
        <FeatureBadge type="beta" />
      </Button>
    );
  }

  renderQueryButton(renderFunc: (disabled: boolean) => React.ReactNode) {
    const {organization} = this.props;
    return (
      <Feature
        organization={organization}
        features={['discover-query']}
        hookName="feature-disabled:discover-saved-query-create"
        renderDisabled={renderDisabled}
      >
        {({hasFeature}) => renderFunc(!hasFeature || this.props.disabled)}
      </Feature>
    );
  }

  renderHomepageFeatureButtons() {
    const {organization, eventView, savedQuery, yAxis, router, location, isHomepage} =
      this.props;

    const contextMenuItems: MenuItemProps[] = [];

    if (organization.features.includes('dashboards-edit')) {
      contextMenuItems.push({
        key: 'add-to-dashboard',
        label: t('Add to Dashboard'),
        onAction: () => {
          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            query: savedQuery,
            yAxis,
            router,
          });
        },
      });
    }

    if (!isHomepage && savedQuery) {
      contextMenuItems.push({
        key: 'delete-saved-query',
        label: t('Delete Saved Query'),
        onAction: () => this.handleDeleteQuery(),
      });
    }

    const contextMenu = (
      <DropdownMenuControl
        items={contextMenuItems}
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            aria-label={t('Discover Context Menu')}
            size="sm"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
            icon={<IconEllipsis />}
          />
        )}
        position="bottom-end"
        offset={4}
      />
    );

    return (
      <ResponsiveButtonBar gap={1}>
        <Feature
          organization={organization}
          features={['discover-query-builder-as-landing-page']}
        >
          {this.renderQueryButton(disabled => this.renderSaveAsHomepage(disabled))}
        </Feature>
        {this.renderQueryButton(disabled => this.renderButtonSave(disabled))}
        <Feature organization={organization} features={['incidents']}>
          {({hasFeature}) => hasFeature && this.renderButtonCreateAlert()}
        </Feature>

        {contextMenuItems.length > 0 && contextMenu}

        <Feature
          organization={organization}
          features={['discover-query-builder-as-landing-page']}
        >
          {this.renderQueryButton(disabled => this.renderButtonViewSaved(disabled))}
        </Feature>
      </ResponsiveButtonBar>
    );
  }

  render() {
    const {organization} = this.props;

    if (organization.features.includes('discover-query-builder-as-landing-page')) {
      return this.renderHomepageFeatureButtons();
    }

    return (
      <ResponsiveButtonBar gap={1}>
        {this.renderQueryButton(disabled => this.renderButtonSave(disabled))}
        <Feature organization={organization} features={['incidents']}>
          {({hasFeature}) => hasFeature && this.renderButtonCreateAlert()}
        </Feature>
        <Feature organization={organization} features={['dashboards-edit']}>
          {({hasFeature}) => hasFeature && this.renderButtonAddToDashboard()}
        </Feature>
        {this.renderQueryButton(disabled => this.renderButtonDelete(disabled))}
      </ResponsiveButtonBar>
    );
  }
}

const ResponsiveButtonBar = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: 0;
  }
`;

const StyledOverlay = styled(Overlay)`
  padding: ${space(1)};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;

const SaveAsInput = styled(InputControl)`
  margin-bottom: ${space(1)};
`;

const IconUpdate = styled('div')`
  display: inline-block;
  width: 10px;
  height: 10px;

  margin-right: ${space(0.75)};
  border-radius: 5px;
  background-color: ${p => p.theme.yellow300};
`;

export default withProjects(withApi(SavedQueryButtonGroup));
