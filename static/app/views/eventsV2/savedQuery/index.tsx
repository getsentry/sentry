import * as React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Banner from 'sentry/components/banner';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import DropdownControl from 'sentry/components/dropdownControl';
import InputControl from 'sentry/components/forms/controls/input';
import {Hovercard} from 'sentry/components/hovercard';
import {IconDelete, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SavedQuery} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetQuery,
} from 'sentry/views/dashboardsV2/types';

import {
  displayModeToDisplayType,
  handleCreateQuery,
  handleDeleteQuery,
  handleUpdateQuery,
} from './utils';

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
  onIncompatibleAlertQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'];
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  savedQuery: SavedQuery | undefined;
  savedQueryLoading: boolean;
  updateCallback: () => void;
  yAxis: string[];
};

type State = {
  isEditingQuery: boolean;
  isNewQuery: boolean;

  queryName: string;
};

class SavedQueryButtonGroup extends React.PureComponent<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const {eventView: nextEventView, savedQuery, savedQueryLoading, yAxis} = nextProps;

    // For a new unsaved query
    if (!savedQuery) {
      return {
        isNewQuery: true,
        isEditingQuery: false,
        queryName: prevState.queryName || '',
      };
    }

    if (savedQueryLoading) {
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

  onBlurInput = (event: React.FormEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    this.setState({queryName: target.value});
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

    const {api, organization, eventView, updateCallback, yAxis} = this.props;

    handleUpdateQuery(api, organization, eventView, yAxis).then(
      (savedQuery: SavedQuery) => {
        const view = EventView.fromSavedQuery(savedQuery);
        this.setState({queryName: ''});
        browserHistory.push(view.getResultsViewShortUrlTarget(organization.slug));
        updateCallback();
      }
    );
  };

  handleDeleteQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, eventView} = this.props;

    handleDeleteQuery(api, organization, eventView).then(() => {
      browserHistory.push({
        pathname: getDiscoverLandingUrl(organization),
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

  handleAddDashboardWidget = () => {
    const {organization, router, location, eventView, savedQuery, yAxis} = this.props;

    const displayType = displayModeToDisplayType(eventView.display as DisplayModes);
    const defaultTableColumns = eventView.fields.map(({field}) => field);
    const sort = eventView.sorts[0];
    const defaultWidgetQuery: WidgetQuery = {
      name: '',
      fields: [
        ...(displayType === DisplayType.TOP_N ? defaultTableColumns : []),
        ...(typeof yAxis === 'string' ? [yAxis] : yAxis ?? ['count()']),
      ],
      conditions: eventView.query,
      orderby: sort ? `${sort.kind === 'desc' ? '-' : ''}${sort.field}` : '',
    };

    trackAdvancedAnalyticsEvent('discover_views.add_to_dashboard.modal_open', {
      organization,
      saved_query: !!savedQuery,
    });

    if (organization.features.includes('new-widget-builder-experience')) {
      router.push({
        pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
        query: {
          ...location.query,
          source: DashboardWidgetSource.DISCOVERV2,
        },
      });
      return;
    }

    openAddDashboardWidgetModal({
      organization,
      source: DashboardWidgetSource.DISCOVERV2,
      defaultWidgetQuery,
      defaultTableColumns,
      defaultTitle:
        savedQuery?.name ??
        (eventView.name !== 'All Events' ? eventView.name : undefined),
      displayType,
    });
  };

  renderButtonSaveAs(disabled: boolean) {
    const {queryName} = this.state;
    /**
     * For a great UX, we should focus on `ButtonSaveInput` when `ButtonSave`
     * is clicked. However, `DropdownControl` wraps them in a FunctionComponent
     * which breaks `React.createRef`.
     */
    return (
      <DropdownControl
        alignRight
        menuWidth="220px"
        priority="default"
        buttonProps={{
          'aria-label': t('Save as'),
          showChevron: false,
          icon: <IconStar />,
          disabled,
        }}
        label={`${t('Save as')}\u{2026}`}
      >
        <ButtonSaveDropDown onClick={SavedQueryButtonGroup.stopEventPropagation}>
          <ButtonSaveInput
            type="text"
            name="query_name"
            placeholder={t('Display name')}
            value={queryName || ''}
            onBlur={this.onBlurInput}
            onChange={this.onChangeInput}
            disabled={disabled}
          />
          <Button
            onClick={this.handleCreateQuery}
            priority="primary"
            disabled={disabled || !this.state.queryName}
            style={{width: '100%'}}
          >
            {t('Save for Org')}
          </Button>
        </ButtonSaveDropDown>
      </DropdownControl>
    );
  }

  renderButtonSave(disabled: boolean) {
    const {isNewQuery, isEditingQuery} = this.state;

    // Existing query that hasn't been modified.
    if (!isNewQuery && !isEditingQuery) {
      return (
        <Button
          icon={<IconStar color="yellow100" isSolid size="sm" />}
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
        <React.Fragment>
          <Button
            onClick={this.handleUpdateQuery}
            data-test-id="discover2-savedquery-button-update"
            disabled={disabled}
          >
            <IconUpdate />
            {t('Save Changes')}
          </Button>
          {this.renderButtonSaveAs(disabled)}
        </React.Fragment>
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
        icon={<IconDelete />}
        aria-label={t('Delete')}
      />
    );
  }

  renderButtonCreateAlert() {
    const {eventView, organization, projects, onIncompatibleAlertQuery} = this.props;

    return (
      <GuideAnchor target="create_alert_from_discover">
        <CreateAlertFromViewButton
          eventView={eventView}
          organization={organization}
          projects={projects}
          onIncompatibleQuery={onIncompatibleAlertQuery}
          onSuccess={this.handleCreateAlertSuccess}
          referrer="discover"
          data-test-id="discover2-create-from-discover"
        />
      </GuideAnchor>
    );
  }

  renderButtonAddToDashboard() {
    return (
      <Button
        key="add-dashboard-widget-from-discover"
        data-test-id="add-dashboard-widget-from-discover"
        onClick={this.handleAddDashboardWidget}
      >
        {t('Add to Dashboard')}
      </Button>
    );
  }

  render() {
    const {organization} = this.props;

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

    const renderQueryButton = (renderFunc: (disabled: boolean) => React.ReactNode) => {
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
    };

    return (
      <ResponsiveButtonBar gap={1}>
        {renderQueryButton(disabled => this.renderButtonSave(disabled))}
        <Feature organization={organization} features={['incidents']}>
          {({hasFeature}) => hasFeature && this.renderButtonCreateAlert()}
        </Feature>
        <Feature organization={organization} features={['dashboards-edit']}>
          {({hasFeature}) => hasFeature && this.renderButtonAddToDashboard()}
        </Feature>
        {renderQueryButton(disabled => this.renderButtonDelete(disabled))}
      </ResponsiveButtonBar>
    );
  }
}

const ResponsiveButtonBar = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-top: 0;
  }
`;

const ButtonSaveDropDown = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(1)};
  gap: ${space(1)};
`;

const ButtonSaveInput = styled(InputControl)`
  height: 40px;
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
