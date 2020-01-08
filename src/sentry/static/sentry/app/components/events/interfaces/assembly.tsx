import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

interface Props {
  name: string;
  version: string;
  culture: string;
  publicKeyToken: string;
  filePath: string;
}

const Assembly: React.FC<Props> = ({
  name,
  version,
  culture,
  publicKeyToken,
  filePath,
}) => {
  return (
    <AssemblyWrapper>
      <Icon src="icon-return-key" />
      <AssemblyInfo>
        <Caption>Assembly:</Caption>
        {name || '-'}
      </AssemblyInfo>
      <AssemblyInfo>
        <Caption>{t('Version')}:</Caption>
        {version || '-'}
      </AssemblyInfo>
      <AssemblyInfo>
        <Caption>{t('Culture')}:</Caption>
        {culture || '-'}
      </AssemblyInfo>
      <AssemblyInfo>
        <Caption>PublicKeyToken:</Caption>
        {publicKeyToken || '-'}
      </AssemblyInfo>

      {filePath && (
        <FilePathInfo>
          <Caption>{t('Path')}:</Caption>
          <TextCopyInput>{filePath}</TextCopyInput>
        </FilePathInfo>
      )}
    </AssemblyWrapper>
  );
};

// TODO(ts): we should be able to delete these after disabling react/prop-types rule in tsx functional components
Assembly.propTypes = {
  name: PropTypes.string.isRequired,
  version: PropTypes.string.isRequired,
  culture: PropTypes.string.isRequired,
  publicKeyToken: PropTypes.string.isRequired,
  filePath: PropTypes.string.isRequired,
};

const AssemblyWrapper = styled('div')`
  font-size: 80%;
  display: flex;
  flex-wrap: wrap;
  color: ${p => p.theme.gray5};
  text-align: center;
  position: relative;
  padding: 0 ${space(3)} 0 50px;
`;

const Icon = styled(InlineSvg)`
  transform: scaleX(-1);
  position: absolute;
  top: 4px;
  left: 25px;
`;

const AssemblyInfo = styled('div')`
  margin-right: 15px;
  margin-bottom: 5px;
`;

const Caption = styled('span')`
  margin-right: 5px;
  font-weight: bold;
`;

const FilePathInfo = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  input {
    width: 250px;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 1.5;
    @media (max-width: ${theme.breakpoints[1]}) {
      width: auto;
    }
  }
  button > span {
    padding: 2px 5px;
  }
  svg {
    width: 0.9em;
    height: 0.9em;
  }
`;

export {Assembly};
