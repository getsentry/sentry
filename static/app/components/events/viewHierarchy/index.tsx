import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Input from 'sentry/components/input';
import {IconInfo, IconPlay} from 'sentry/icons';

const SEARCH = true;

function ViewHierarchy({hierarchy, searchTerm, showData}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showingData, setShowingData] = useState(false);
  const [searchValue, setSearchValue] = useState(searchTerm ?? '');
  const [showAllData, setShowAllData] = useState(false);

  let match;
  let kindOfMatches;
  if (searchTerm) {
    const [key, value] = searchTerm.split('=');
    if (value && Object.keys(hierarchy.meta).includes(key)) {
      match = hierarchy.meta[key].toLowerCase() === value.toLowerCase();
      kindOfMatches =
        value && hierarchy.meta[key].toLowerCase().includes(value.toLowerCase());
    }

    if (key === 'title' && value) {
      match =
        hierarchy.title.split(': ')[0].toLowerCase() === value.toLowerCase() ||
        (value.includes(': ') &&
          hierarchy.title.toLowerCase().startsWith(value.toLowerCase()));
      kindOfMatches =
        value && hierarchy.title.toLowerCase().includes(value.toLowerCase());
    }
  }

  return (
    <Fragment>
      {SEARCH && hierarchy.title === 'UIWindow: 0x7f893fc0ebd0' && (
        <div style={{display: 'flex'}}>
          <Input
            style={{margin: '18px', marginTop: '0', width: '50%'}}
            value={searchValue}
            onChange={e => {
              e.preventDefault();
              setSearchValue(e.target.value);
            }}
            placeholder="Search for a key=value pair"
          />
          <Button
            priority="primary"
            size="sm"
            onClick={() => setShowAllData(!showAllData)}
          >
            {showAllData ? 'Hide All Data' : 'Show All Data'}
          </Button>
        </div>
      )}
      <Container>
        <div
          style={{display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px'}}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {!!hierarchy.children.length && (
            <StyledExpandIcon
              fill="black"
              fillOpacity="1"
              size="xs"
              collapsed={collapsed}
              onClick={() => {
                setCollapsed(!collapsed);
                setShowingData(false);
              }}
            />
          )}
          <div
            style={{
              background: match ? 'lightgreen' : kindOfMatches ? 'yellow' : 'none',
            }}
          >
            <strong>{hierarchy.title}</strong>
          </div>
          {hierarchy.meta.frame}
          {hovered && (
            <div
              // onClick={() => alert(JSON.stringify(hierarchy.meta, null, 2) + '\n')}
              onClick={() => setShowingData(!showingData)}
              style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}
            >
              <IconInfo />
            </div>
          )}
        </div>

        {(showData || showingData || showAllData) && (
          <table style={{marginLeft: '18px', borderSpacing: '4px'}}>
            <tr>
              {Object.keys(hierarchy.meta).map(key => (
                <td style={{border: '0.5px solid black', padding: '4px'}}>
                  <strong>{key}</strong>
                </td>
              ))}
            </tr>
            <tr>
              {Object.values(hierarchy.meta).map(value => (
                <td style={{border: '0.5px solid black', padding: '4px'}}>{value}</td>
              ))}
            </tr>
          </table>
        )}

        {!collapsed &&
          !!hierarchy.children.length &&
          hierarchy.children.map((child, i) => (
            <Container key={`${hierarchy.title}-${i}`}>
              <ViewHierarchy
                hierarchy={child}
                searchTerm={searchValue || searchTerm}
                showData={showAllData || showData}
              />
            </Container>
          ))}
      </Container>
    </Fragment>
  );
}

const Container = styled('div')`
  margin-left: 18px;
  margin-bottom: 4px;
`;

const StyledExpandIcon = styled(IconPlay)<{collapsed: boolean}>`
  rotate: 90deg;
  ${p =>
    p.collapsed &&
    `
    rotate: 0deg;
  `}
`;

export default ViewHierarchy;
