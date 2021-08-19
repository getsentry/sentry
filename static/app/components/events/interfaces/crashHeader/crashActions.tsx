import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {ExceptionType, ExceptionValue} from 'app/types';
import {Thread} from 'app/types/events';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

type NotifyOptions = {
  stackView?: STACK_VIEW;
  stackType?: STACK_TYPE;
};

type Props = {
  hasHierarchicalGrouping: boolean;
  stackView?: STACK_VIEW;
  stackType?: STACK_TYPE;
  platform?: string;
  stacktrace?: ExceptionValue['stacktrace'];
  thread?: Thread;
  exception?: ExceptionType;
  onChange?: (notifyOptions: NotifyOptions) => void;
};

const CrashActions = ({
  hasHierarchicalGrouping,
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
    !!exception?.values?.find(value => !!value.stacktrace?.hasSystemFrames);

  const hasMinified = !stackType
    ? false
    : !!exception?.values?.find(value => value.rawStacktrace) || !!thread?.rawStacktrace;

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
            {hasHierarchicalGrouping ? t('Most Revelant') : t('App Only')}
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
  > *:not(:last-child) {
    margin-right: ${space(1)};
  }
`;
