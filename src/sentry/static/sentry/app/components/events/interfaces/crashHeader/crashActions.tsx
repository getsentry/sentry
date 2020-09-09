import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import space from 'app/styles/space';

enum STACK_VIEW {
  RAW = 'raw',
  FULL = 'full',
  APP = 'app',
}

enum STACK_TYPE {
  ORIGINAL = 'original',
  MINIFIED = 'minified',
}

type NotifyOptions = {
  stackView?: STACK_VIEW;
  stackType?: STACK_TYPE;
};

type Props = {
  platform: string;
  stackView: string;
  stackType?: string;
  // TODO(ts): create types for the following Record props:
  stacktrace?: Record<string, any>;
  thread?: Record<string, any>;
  exception?: Record<string, any>;
  onChange?: (notifyOptions: NotifyOptions) => void;
};

const CrashActions = ({
  stackView,
  stackType,
  stacktrace,
  thread,
  exception,
  platform,
  onChange,
}: Props) => {
  const hasSystemFrames: boolean =
    stacktrace?.hasSystemFrames ||
    thread?.stacktrace?.hasSystemFrames ||
    exception?.values.find(x => !!x?.stacktrace?.hasSystemFrames);

  const hasMinified = !stackType
    ? false
    : !!exception?.values.find(x => x.rawStacktrace) || !!thread?.rawStacktrace;

  const notify = (options: NotifyOptions) => {
    if (onChange) {
      onChange(options);
    }
  };

  const setStackType = (type: STACK_TYPE) => () => {
    notify({stackType: type});
  };

  const setStackView = (view: STACK_VIEW) => () => {
    notify({stackView: view});
  };

  const getOriginalButtonLabel = () => {
    if (platform === 'javascript' || platform === 'node') {
      return t('Original');
    }

    return t('Symbolicated');
  };

  const getMinifiedButtonLabel = () => {
    if (platform === 'javascript' || platform === 'node') {
      return t('Minified');
    }
    return t('Unsymbolicated');
  };

  return (
    <ButtonGroupWrapper>
      <ButtonBar active={stackView} merged>
        {hasSystemFrames && (
          <Button
            barId={STACK_VIEW.APP}
            size="xsmall"
            onClick={setStackView(STACK_VIEW.APP)}
          >
            {t('App Only')}
          </Button>
        )}
        <Button
          barId={STACK_VIEW.FULL}
          size="xsmall"
          onClick={setStackView(STACK_VIEW.FULL)}
        >
          {t('Full')}
        </Button>
        <Button
          barId={STACK_VIEW.RAW}
          onClick={setStackView(STACK_VIEW.RAW)}
          size="xsmall"
        >
          {t('Raw')}
        </Button>
      </ButtonBar>
      {hasMinified && (
        <ButtonBar active={stackType} merged>
          <Button
            barId={STACK_TYPE.ORIGINAL}
            size="xsmall"
            onClick={setStackType(STACK_TYPE.ORIGINAL)}
          >
            {getOriginalButtonLabel()}
          </Button>
          <Button
            barId={STACK_TYPE.MINIFIED}
            size="xsmall"
            onClick={setStackType(STACK_TYPE.MINIFIED)}
          >
            {getMinifiedButtonLabel()}
          </Button>
        </ButtonBar>
      )}
    </ButtonGroupWrapper>
  );
};

export default CrashActions;

const ButtonGroupWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  > * {
    padding: ${space(0.5)} 0;
  }
  > * :not(:last-child) {
    margin-right: ${space(1)};
  }
`;
