import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';

import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';

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
  location: Location;
  organization: Organization;
  eventView: EventView;
  savedQueries: SavedQuery[];
  savedQueriesLoading: boolean;
};
type State = {
  isNewQuery: boolean;
  isEditingQuery: boolean;

  queryId: string | undefined;
  queryName: string;
};

class SavedQueryButtonGroup extends React.PureComponent<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    const {eventView: nextEventView, savedQueries, savedQueriesLoading} = nextProps;

    // For a new unsaved query
    const savedQuery = savedQueries.find(q => q.id === nextEventView.id);
    if (!savedQuery) {
      return {
        isNewQuery: true,
        isEditingQuery: false,
        queryId: undefined,
        queryName: prevState.queryName || '',
      };
    }

    if (savedQueriesLoading) {
      return prevState;
    }

    const savedEventView = EventView.fromSavedQuery(savedQuery);

    // Switching from a SavedQuery to another SavedQuery
    if (savedEventView.id !== nextEventView.id) {
      return {
        isNewQuery: false,
        isEditingQuery: false,
        queryId: nextEventView.id,
        queryName: '',
      };
    }

    // For modifying a SavedQuery
    const isEqualQuery = nextEventView.isEqualTo(savedEventView);

    return {
      isNewQuery: false,
      isEditingQuery: !isEqualQuery,
      queryId: nextEventView.id,

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

    queryId: undefined,
    queryName: '',
  };

  onBlurInput = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({queryName: event.currentTarget.value});
  };
  onChangeInput = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({queryName: event.currentTarget.value});
  };

  /**
   * There are two ways to create a query
   * 1) Creating a query from scratch and saving it
   * 2) Modifying an existing query and saving it
   */
  handleCreateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, location, organization} = this.props;
    const eventView = EventView.fromLocation({
      ...location,
      query: {
        ...location.query,
        name: this.state.queryName,
      },
    });

    // Checks if "Save as" button is clicked from a clean state, or it is
    // clicked while modifying an existing query
    const isNewQuery = !!this.state.queryId;

    handleCreateQuery(api, organization, eventView, isNewQuery).then(
      (savedQuery: any) => {
        const view = EventView.fromSavedQuery(savedQuery);

        browserHistory.push({
          pathname: location.pathname,
          query: view.generateQueryStringObject(),
        });
        this.setState({queryName: ''});
      }
    );
  };

  handleUpdateQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, location, organization} = this.props;
    const eventView = EventView.fromLocation(location);

    handleUpdateQuery(api, organization, eventView).then(() => {
      this.setState({queryName: ''});
    });
  };

  handleDeleteQuery = (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, location, organization} = this.props;
    const eventView = EventView.fromLocation(location);

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
          <ButtonSave
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
          </ButtonSave>
        )}
      >
        <ButtonSaveDropDown onClick={SavedQueryButtonGroup.stopEventPropagation}>
          <ButtonSaveInput
            type="text"
            placeholder={t('Display name')}
            value={queryName || ''}
            onBlur={this.onBlurInput}
            onChange={this.onChangeInput}
          />
          <Button
            onClick={this.handleCreateQuery}
            priority="primary"
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
      <Button onClick={this.handleUpdateQuery}>
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

    return <Button icon="icon-trash" onClick={this.handleDeleteQuery} />;
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

  > * + * {
    margin-left: ${space(1)};
  }
`;

const ButtonSave = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
`;
const ButtonSaved = styled(Button)`
  cursor: not-allowed;
`;
const ButtonSaveIcon = styled(InlineSvg)<{isNewQuery?: boolean}>`
  margin-top: -3px; /* Align SVG vertically to text */
  margin-right: ${space(0.75)};

  color: ${p => (p.isNewQuery ? p.theme.yellow : '#C4C4C4')};
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

export default withApi(withDiscoverSavedQueries(SavedQueryButtonGroup));
