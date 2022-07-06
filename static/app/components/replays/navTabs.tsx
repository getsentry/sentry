import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type Props = {
  underlined: boolean;
};
const NavTabs = styled('ul')<Props>`
  border-bottom: ${p => (p.underlined ? '1px solid #e2dee6' : 'none')};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 0 ${space(3)};
  padding-left: 0;

  & > li {
    float: left;
    margin-bottom: -1px;
    position: relative;
    display: block;
  }

  & > li a {
    position: relative;
    border-radius: ${space(0.5)} ${space(0.5)} 0 0;

    display: flex;
    align-items: center;
    padding: 0 10px 0;
    margin: 0;
    border: 0;
    background: none;
    color: #7c6a8e;
    min-width: 30px;
    text-align: center;
  }

  & > li:first-child a {
    padding-left: 0;
  }

  & > li:last-child a {
    padding-right: 0;
  }

  & > li a > span {
    padding-bottom: 10px;
  }

  & > li.active a {
    cursor: pointer;
    border: 0;
    background: none;
    color: #161319;
    font-weight: normal;
  }

  & > li.active a > span {
    border-bottom: ${space(0.5)} solid ${p => p.theme.purple300};
  }
`;

export default NavTabs;
