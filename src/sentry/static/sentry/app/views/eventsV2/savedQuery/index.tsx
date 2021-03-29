import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import DropdownControl from 'app/components/dropdownControl';
import Hovercard from 'app/components/hovercard';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, SavedQuery} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'app/utils/discover/urls';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';
import {setBannerHidden} from 'app/views/eventsV2/utils';
import InputControl from 'app/views/settings/components/forms/controls/input';

import {handleCreateQuery, handleDeleteQuery, handleUpdateQuery} from './utils';

type DefaultProps = {
  disabled: boolean;
};

type Props = DefaultProps & {
  api: Client;

  /**
   * DO NOT USE `Location` TO GENERATE `EventView` IN THIS COMPONENT.
   *
   * In this component, state is generated from EventView and SavedQueriesStore.
   * Using Location to rebuild EventView will break the tests. `Location` is
   * passed down only because it is needed for navigation.
   */
  location: Location;
  organization: Organization;
  eventView: EventView;
  savedQuery: SavedQuery | undefined;
  savedQueryLoading: boolean;
  projects: Project[];
  updateCallback: () => void;
  onIncompatibleAlertQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'];
};

type State = {
  isNewQuery: boolean;
  isEditingQuery: boolean;

  queryName: string;
};

class SavedQueryButtonGroup extends React.PureComponent<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const {eventView: nextEventView, savedQuery, savedQueryLoading} = nextProps;

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
    return {
      isNewQuery: false,
      isEditingQuery: !isEqualQuery,

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

  state = {
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

    const {api, organization, eventView} = this.props;

    if (!this.state.queryName) {
      return;
    }

    const nextEventView = eventView.clone();
    nextEventView.name = this.state.queryName;

    // Checks if "Save as" button is clicked from a clean state, or it is
    // clicked while modifying an existing query
    const isNewQuery = !eventView.id;

    handleCreateQuery(api, organization, nextEventView, isNewQuery).then(
      (savedQuery: SavedQuery) => {
        const view = EventView.fromSavedQuery(savedQuery);

        setBannerHidden(true);
        this.setState({queryName: ''});
        browserHistory.push(view.getResultsViewUrlTarget(organization.slug));
      }
    );
  };

  handleUpdateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, eventView, updateCallback} = this.props;

    handleUpdateQuery(api, organization, eventView).then((savedQuery: SavedQuery) => {
      const view = EventView.fromSavedQuery(savedQuery);
      this.setState({queryName: ''});
      browserHistory.push(view.getResultsViewUrlTarget(organization.slug));
      updateCallback();
    });
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
            {t('Save')}
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
        <Button disabled data-test-id="discover2-savedquery-button-saved">
          {t('Saved query')}
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
