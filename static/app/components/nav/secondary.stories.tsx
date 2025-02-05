import {useState} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {NavContextProvider} from 'sentry/components/nav/context';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {SecondarySidebar} from 'sentry/components/nav/secondarySidebar';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('SecondaryNav', story => {
  story('Basics (WIP)', () => {
    const [activeItem, setActiveItem] = useState<string | null>('product-area-1');

    return (
      <Container>
        <NavContextProvider>
          <SecondarySidebar />
          <SecondaryNav group={PrimaryNavGroup.ISSUES}>
            <SecondaryNav.Body>
              <SecondaryNav.Section>
                <SecondaryNav.Item
                  to="/product-area-1"
                  isActive={activeItem === 'product-area-1'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-1');
                  }}
                >
                  Product Area 1
                </SecondaryNav.Item>
                <SecondaryNav.Item
                  to="/product-area-2"
                  isActive={activeItem === 'product-area-2'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-2');
                  }}
                >
                  Product Area 2
                </SecondaryNav.Item>
                <SecondaryNav.Item
                  to="/product-area-3"
                  isActive={activeItem === 'product-area-3'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-3');
                  }}
                >
                  Product Area 3
                </SecondaryNav.Item>
              </SecondaryNav.Section>
              <SecondaryNav.Section title="Starred">
                <SecondaryNav.Item
                  to="/starred-item"
                  isActive={activeItem === 'starred-item'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('starred-item');
                  }}
                >
                  Starred Item
                </SecondaryNav.Item>
              </SecondaryNav.Section>
            </SecondaryNav.Body>
            <SecondaryNav.Footer>
              <SecondaryNav.Item
                to="/footer-item"
                onClick={e => {
                  e.preventDefault();
                  setActiveItem('footer-item');
                }}
                isActive={activeItem === 'footer-item'}
              >
                Footer Item
              </SecondaryNav.Item>
            </SecondaryNav.Footer>
          </SecondaryNav>
        </NavContextProvider>
      </Container>
    );
  });
});

const Container = styled(NegativeSpaceContainer)`
  padding: ${space(2)};
  height: 400px;
  width: min-content;
`;
