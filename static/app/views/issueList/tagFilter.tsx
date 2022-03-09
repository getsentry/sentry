import * as React from 'react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Input from 'sentry/components/forms/controls/input';
import SelectControl from 'sentry/components/forms/selectControl';
import SidebarSection from 'sentry/components/sidebarSection';
import {t, tct} from 'sentry/locale';
import {Tag, TagValue} from 'sentry/types';

import {TagValueLoader} from './types';

const defaultProps = {
  value: '',
};

type SelectOption = Record<'value' | 'label', string>;

type Props = {
  onSelect: (tag: Tag, value: string | null) => void;
  tag: Tag;
  tagValueLoader: TagValueLoader;
} & typeof defaultProps;

type State = {
  isLoading: boolean;
  query: string;
  textValue: string;
  value: string | null;
  options?: SelectOption[];
};

class IssueListTagFilter extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    query: '',
    isLoading: false,
    value: this.props.value,
    textValue: this.props.value,
  };

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

  api = new Client();

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
          options: Object.values(resp).map(
            ({value}: TagValue): SelectOption => ({
              value,
              label: value,
            })
          ),
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
    const {options, isLoading} = this.state;

    return (
      <SidebarSection title={tag.key}>
        {!!tag.isInput && (
          <Input value={this.state.textValue} onChange={this.handleChangeInput} />
        )}

        {!tag.isInput && (
          <SelectControl
            clearable
            aria-label={tag.key}
            placeholder="--"
            loadingMessage={() => t('Loading\u2026')}
            value={this.state.value}
            onChange={this.handleChangeSelect}
            isLoading={isLoading}
            onInputChange={this.handleChangeSelectInput}
            onFocus={this.handleOpenMenu}
            noResultsText={isLoading ? t('Loading\u2026') : t('No results found')}
            options={
              tag.predefined
                ? tag.values &&
                  tag.values.map(value => ({
                    value,
                    label: value,
                  }))
                : options
            }
          />
        )}
      </SidebarSection>
    );
  }
}

export default IssueListTagFilter;
