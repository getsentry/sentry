import styled from '@emotion/styled';

type Props = {
  underlined: boolean;
};
const NavTabs = styled('ul')<Props>`
  margin: 0 0 20px;
  padding-left: 0;
  font-size: 14px;
  border-bottom: ${p => (p.underlined ? '1px solid #e2dee6' : 'none')};

  & > li {
    float: left;
    margin-bottom: -1px;
    position: relative;
    display: block;
  }

  & > li a {
    position: relative;
    border-radius: 4px 4px 0 0;

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
    font-weight: 400;
  }

  & > li.active a > span {
    border-bottom: 4px solid ${p => p.theme.purple300};
  }
`;

export default NavTabs;
