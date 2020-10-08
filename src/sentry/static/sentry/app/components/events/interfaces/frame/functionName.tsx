import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {Meta, Frame} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';

type Props = {
  frame: Frame;
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

class FunctionName extends React.Component<Props, State> {
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
    const {frame} = this.props;
    let valueOutput: ToggleValueOutput = t('<unknown>');

    if (withRawFunctionCondition) {
      const {rawFunction} = this.state;
      if (!rawFunction) {
        if (frame.function) {
          valueOutput = {
            value: frame.function,
            meta: getMeta(frame, 'function'),
          };
        }
      }
    } else {
      if (frame.function) {
        valueOutput = {
          value: frame.function,
          meta: getMeta(frame, 'function'),
        };
      }
    }

    if (typeof valueOutput === 'string' && frame.rawFunction) {
      valueOutput = {
        value: frame.rawFunction,
        meta: getMeta(frame, 'rawFunction'),
      };
    }

    if (typeof valueOutput === 'string') {
      return valueOutput;
    }

    return <AnnotatedText value={valueOutput.value} meta={valueOutput.meta} />;
  }

  render() {
    const {frame, ...props} = this.props;
    const func = frame.function;
    const rawFunc = frame.rawFunction;
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

export default FunctionName;
