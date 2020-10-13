import debounce from 'lodash/debounce';
import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';
import {Tag, TagValue} from 'app/types';

const defaultProps = {
  value: '',
};

type SelectOption = Record<'value' | 'label', string>;

type Props = {
  tag: Tag;
  onSelect: (tag: Tag, value: string | null) => void;
  tagValueLoader: (
    key: string,
    search: string,
    projectIds?: string[]
  ) => Promise<TagValue[]>;
} & typeof defaultProps;

type State = {
  query: string;
  isLoading: boolean;
  value: string | null;
  textValue: string;
  options?: SelectOption[];
};

class IssueListTagFilter extends React.Component<Props, State> {
  static tagValueToSelectFormat = ({value}: TagValue): SelectOption => ({
    value,
    label: value,
  });

  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);
    this.state = {
      query: '',
      isLoading: false,
      value: this.props.value,
      textValue: this.props.value,
    };
    this.api = new Client();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.value !== this.state.value) {
      this.setState({
        value: nextProps.value,
        textValue: nextProps.value,
      });
    }
  }

  componentWillUnmount() {
    if (!this.api) {
      return;
    }
    this.api.clear();
  }

  api: Client;

  handleLoadOptions = () => {
    const {tag, tagValueLoader} = this.props;
    const {textValue} = this.state;
    if (tag.isInput || tag.predefined) {
      return;
    }
    if (!this.api) {
      return;
    }

    this.setState({
      isLoading: true,
    });

    tagValueLoader(tag.key, textValue)
      .then(resp => {
        this.setState({
          isLoading: false,
          options: Object.values(resp).map(IssueListTagFilter.tagValueToSelectFormat),
        });
      })
      .catch(() => {
        // TODO(billy): This endpoint seems to timeout a lot,
        // should we log these errors into datadog?

        addErrorMessage(
          tct('Unable to retrieve values for tag [tagName]', {
            tagName: textValue,
          })
        );
      });
  };

  handleChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    this.setState({
      textValue: value,
    });
    this.debouncedTextChange(value);
  };

  debouncedTextChange = debounce(text => {
    this.handleChange(text);
  }, 150);

  handleOpenMenu = () => {
    if (this.props.tag.predefined) {
      return;
    }

    this.setState(
      {
        isLoading: true,
      },
      this.handleLoadOptions
    );
  };

  handleChangeSelect = (valueObj: SelectOption | null) => {
    const value = valueObj ? valueObj.value : null;
    this.handleChange(value);
  };

  handleChangeSelectInput = (value: string) => {
    this.setState(
      {
        textValue: value,
      },
      this.handleLoadOptions
    );
  };

  handleChange = (value: string | null) => {
    const {onSelect, tag} = this.props;

    this.setState(
      {
        value,
      },
      () => {
        onSelect && onSelect(tag, value);
      }
    );
  };

  render() {
    const {tag} = this.props;
    return (
      <div className="stream-tag-filter">
        <h6 className="nav-header">{tag.key}</h6>

        {!!tag.isInput && (
          <input
            className="form-control"
            type="text"
            value={this.state.textValue}
            onChange={this.handleChangeInput}
          />
        )}

        {!tag.isInput && (
          <SelectControl
            deprecatedSelectControl
            clearable
            filterOptions={options => options}
            placeholder="--"
            value={this.state.value}
            onChange={this.handleChangeSelect}
            isLoading={this.state.isLoading}
            onInputChange={this.handleChangeSelectInput}
            onOpen={this.handleOpenMenu}
            autoload={false}
            noResultsText={this.state.isLoading ? t('Loading...') : t('No results found')}
            options={
              tag.predefined
                ? tag.values &&
                  tag.values.map(value => ({
                    value,
                    label: value,
                  }))
                : this.state.options
            }
          />
        )}
      </div>
    );
  }
}

export default IssueListTagFilter;
