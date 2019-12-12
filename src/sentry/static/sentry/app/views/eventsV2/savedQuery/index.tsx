import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, SavedQuery} from 'app/types';
import withApi from 'app/utils/withApi';

import Button from 'app/components/button';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl from 'app/components/dropdownControl';
import InlineSvg from 'app/components/inlineSvg';
import Input from 'app/components/forms/input';
import space from 'app/styles/space';

import EventView from '../eventView';
import {handleCreateQuery, handleUpdateQuery, handleDeleteQuery} from './utils';

type Props = {
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
};

type State = {
  isNewQuery: boolean;
  isEditingQuery: boolean;

  queryName: string;
};

class SavedQueryButtonGroup extends React.PureComponent<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
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

    const {api, location, organization, eventView} = this.props;

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

        this.setState({queryName: ''});
        browserHistory.push({
          pathname: location.pathname,
          query: view.generateQueryStringObject(),
        });
      }
    );
  };

  handleUpdateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, eventView} = this.props;

    handleUpdateQuery(api, organization, eventView).then((savedQuery: SavedQuery) => {
      const view = EventView.fromSavedQuery(savedQuery);
      this.setState({queryName: ''});
      browserHistory.push({
        pathname: location.pathname,
        query: view.generateQueryStringObject(),
      });
    });
  };

  handleDeleteQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, location, organization, eventView} = this.props;

    handleDeleteQuery(api, organization, eventView).then(() => {
      browserHistory.push({
        pathname: location.pathname,
        query: {},
      });
    });
  };

  renderButtonSaveAs() {
    const {isNewQuery, isEditingQuery, queryName} = this.state;

    if (!isNewQuery && !isEditingQuery) {
      return null;
    }

    /**
     * For a great UX, we should focus on `ButtonSaveInput` when `ButtonSave`
     * is clicked. However, `DropdownControl` wraps them in a FunctionComponent
     * which breaks `React.createRef`.
     */
    return (
      <DropdownControl
        alignRight
        menuWidth="220px"
        button={({isOpen, getActorProps}) => (
          <ButtonSaveAs
            data-test-id="button-save-as"
            {...getActorProps({isStyled: true})}
            isOpen={isOpen}
            showChevron={false}
          >
            <ButtonSaveIcon
              isNewQuery={isNewQuery}
              src="icon-star-small-filled"
              size="14"
            />
            {t('Save as...')}
          </ButtonSaveAs>
        )}
      >
        <ButtonSaveDropDown onClick={SavedQueryButtonGroup.stopEventPropagation}>
          <ButtonSaveInput
            type="text"
            name="query_name"
            placeholder={t('Display name')}
            value={queryName || ''}
            onBlur={this.onBlurInput}
            onChange={this.onChangeInput}
          />
          <Button
            data-test-id="button-save-query"
            onClick={this.handleCreateQuery}
            priority="primary"
            disabled={!this.state.queryName}
            style={{width: '100%'}}
          >
            {t('Save')}
          </Button>
        </ButtonSaveDropDown>
      </DropdownControl>
    );
  }

  renderButtonSaved() {
    const {isNewQuery, isEditingQuery} = this.state;

    if (isNewQuery || isEditingQuery) {
      return null;
    }

    return (
      <ButtonSaved>
        <ButtonSaveIcon isNewQuery={isNewQuery} src="icon-star-small-filled" size="14" />
        {t('Saved query')}
      </ButtonSaved>
    );
  }

  renderButtonUpdate() {
    const {isNewQuery, isEditingQuery} = this.state;

    if (isNewQuery || !isEditingQuery) {
      return null;
    }

    return (
      <Button
        onClick={this.handleUpdateQuery}
        data-test-id="discover2-savedquery-button-update"
      >
        <ButtonUpdateIcon />
        {t('Update query')}
      </Button>
    );
  }

  renderButtonDelete() {
    const {isNewQuery} = this.state;

    if (isNewQuery) {
      return null;
    }

    return (
      <Button
        data-test-id="discover2-savedquery-button-delete"
        icon="icon-trash"
        onClick={this.handleDeleteQuery}
      />
    );
  }

  render() {
    return (
      <ButtonGroup>
        {this.renderButtonDelete()}
        {this.renderButtonSaveAs()}
        {this.renderButtonUpdate()}
        {this.renderButtonSaved()}
      </ButtonGroup>
    );
  }
}

const ButtonGroup = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-top: 0;
  }
`;

const ButtonSaveAs = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
`;
const ButtonSaved = styled(Button)`
  cursor: not-allowed;
`;
const ButtonSaveIcon = styled(InlineSvg)<{isNewQuery?: boolean}>`
  margin-top: -3px; /* Align SVG vertically to text */
  margin-right: ${space(0.75)};

  color: ${p => (p.isNewQuery ? p.theme.gray1 : p.theme.yellow)};
`;
const ButtonSaveDropDown = styled('li')`
  padding: ${space(1)};
`;
const ButtonSaveInput = styled(Input)`
  width: 100%;
  margin-bottom: ${space(1)};
`;

const ButtonUpdateIcon = styled('div')`
  display: inline-block;
  width: 10px;
  height: 10px;

  margin-right: ${space(0.75)};
  border-radius: 5px;
  background-color: ${p => p.theme.yellow};
`;

export default withApi(SavedQueryButtonGroup);
