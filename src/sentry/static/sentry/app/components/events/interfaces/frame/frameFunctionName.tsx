import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {Meta} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';

import {Data} from './types';

type Props = {
  data: Data;
  className?: string;
};

type State = {
  rawFunction: boolean;
};

type ToggleValueOutput =
  | string
  | {
      value: string;
      meta?: Meta;
    };

class FrameFunctionName extends React.Component<Props, State> {
  static propTypes = {
    frame: PropTypes.object,
  };

  state = {
    rawFunction: false,
  };

  toggle = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    this.setState(({rawFunction}) => ({rawFunction: !rawFunction}));
  };

  getToggleValue(withRawFunctionCondition: boolean = false): React.ReactNode {
    const {data} = this.props;
    let valueOutput: ToggleValueOutput = t('<unknown>');

    if (withRawFunctionCondition) {
      const {rawFunction} = this.state;
      if (!rawFunction) {
        if (data.function) {
          valueOutput = {
            value: data.function,
            meta: getMeta(data, 'function'),
          };
        }
      }
    } else {
      if (data.function) {
        valueOutput = {
          value: data.function,
          meta: getMeta(data, 'function'),
        };
      }
    }

    if (data.rawFunction) {
      valueOutput = {
        value: data.rawFunction,
        meta: getMeta(data, 'rawFunction'),
      };
    }

    if (typeof valueOutput === 'string') {
      return valueOutput;
    }

    if (!valueOutput.meta) {
      return valueOutput.value;
    }

    return (
      <AnnotatedText
        value={valueOutput.value}
        chunks={valueOutput.meta.chunks}
        remarks={valueOutput.meta.rem}
        errors={valueOutput.meta.err}
      />
    );
  }

  render() {
    const {data, ...props} = this.props;
    const func = data.function;
    const rawFunc = data.rawFunction;
    const canToggle = rawFunc && func && func !== rawFunc;

    if (!canToggle) {
      return <code {...props}>{this.getToggleValue()}</code>;
    }
    const title = this.state.rawFunction ? undefined : rawFunc;
    return (
      <code {...props} title={title} onClick={this.toggle}>
        {this.getToggleValue(true)}
      </code>
    );
  }
}

export default FrameFunctionName;
