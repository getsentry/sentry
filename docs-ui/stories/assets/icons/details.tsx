import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import Code from 'docs-ui/components/code';

import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import space from 'sentry/styles/space';

import {iconProps} from './data';
import IconSample from './sample';
import {ExtendedIconData} from './searchPanel';

type Props = {
  icon: ExtendedIconData;
};

const Details = ({icon}: Props) => {
  // Editable icon props
  const [size, setSize] = useState(iconProps.size.default);
  const [direction, setDirection] = useState(
    icon.defaultProps?.direction ?? iconProps.direction.default
  );
  const [type, setType] = useState(icon.defaultProps?.type ?? iconProps.type.default);
  const [isCircled, setIsCircled] = useState(icon.defaultProps?.isCircled ?? false);
  const [isSolid, setIsSolid] = useState(icon.defaultProps?.isSolid ?? false);

  /**
   * Generate and update code sample based on prop states
   */
  const getCodeSample = useCallback(() => {
    return `<Icon${icon.name} color="gray500" size="${size}"${
      isCircled ? ' isCircled' : ' '
    }${isSolid ? ' isSolid' : ' '} />`;
  }, [icon.name, size, isCircled, isSolid]);

  const [codeSample, setCodeSample] = useState(getCodeSample());

  useEffect(() => void setCodeSample(getCodeSample()), [getCodeSample]);

  return (
    <Wrap>
      <SampleWrap>
        <IconSample
          name={icon.name}
          size={size}
          color="gray500"
          {...(icon.additionalProps?.includes('type') ? {type} : {})}
          {...(icon.additionalProps?.includes('direction') ? {direction} : {})}
          {...(isCircled ? {isCircled} : {})}
          {...(isSolid ? {isSolid} : {})}
        />
      </SampleWrap>

      <FieldContainer>
        <SelectField
          name="size"
          label="Size"
          defaultValue={iconProps.size.default}
          options={iconProps.size.options ?? []}
          onChange={(value: string) => setSize(value)}
          clearable={false}
        />
        {icon.additionalProps?.includes('direction') && (
          <SelectField
            name="direction"
            label="Direction"
            defaultValue={direction}
            options={iconProps.direction.options ?? []}
            onChange={(value: string) => setDirection(value)}
            clearable={false}
          />
        )}
        {icon.additionalProps?.includes('type') && (
          <SelectField
            name="type"
            defaultValue={type}
            options={iconProps.type.options ?? []}
            onChange={(value: string) => setType(value)}
            clearable={false}
          />
        )}
        {icon.additionalProps?.includes('isCircled') && (
          <BooleanField
            name="isCircled"
            label="Circled"
            value={isCircled}
            onChange={value => setIsCircled(value)}
          />
        )}
        {icon.additionalProps?.includes('isSolid') && (
          <BooleanField
            name="isSolid"
            label="Solid"
            value={isSolid}
            onChange={value => setIsSolid(value)}
          />
        )}
      </FieldContainer>

      <Code className="language-jsx">{codeSample}</Code>
    </Wrap>
  );
};

export default Details;

const Wrap = styled('div')`
  max-width: 20rem;
`;

const SampleWrap = styled('div')`
  width: 100%;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto ${space(3)};
`;

const FieldContainer = styled('div')`
  margin: -${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
