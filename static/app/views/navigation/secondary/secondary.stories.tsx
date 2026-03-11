import {useState} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import * as Storybook from 'sentry/stories';
import {NavigationContextProvider} from 'sentry/views/navigation/navigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';

export default Storybook.story('SecondaryNavigation', story => {
  story('Basics (WIP)', () => {
    const [activeItem, setActiveItem] = useState<string | null>('product-area-1');

    return (
      <Container>
        <NavigationContextProvider>
          <StyledSecondaryNavigation>
            <SecondaryNavigation.Header>Section Title</SecondaryNavigation.Header>
            <SecondaryNavigation.Body>
              <SecondaryNavigation.Section id="stories-product-areas">
                <SecondaryNavigation.Item
                  to="/product-area-1"
                  isActive={activeItem === 'product-area-1'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-1');
                  }}
                >
                  Product Area 1
                </SecondaryNavigation.Item>
                <SecondaryNavigation.Item
                  to="/product-area-2"
                  isActive={activeItem === 'product-area-2'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-2');
                  }}
                >
                  Product Area 2
                </SecondaryNavigation.Item>
                <SecondaryNavigation.Item
                  to="/product-area-3"
                  isActive={activeItem === 'product-area-3'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('product-area-3');
                  }}
                >
                  Product Area 3
                </SecondaryNavigation.Item>
              </SecondaryNavigation.Section>
              <SecondaryNavigation.Section id="stories-starred" title="Starred">
                <SecondaryNavigation.Item
                  to="/starred-item"
                  isActive={activeItem === 'starred-item'}
                  onClick={e => {
                    e.preventDefault();
                    setActiveItem('starred-item');
                  }}
                >
                  Starred Item
                </SecondaryNavigation.Item>
              </SecondaryNavigation.Section>
            </SecondaryNavigation.Body>
            <SecondaryNavigation.Footer>
              <SecondaryNavigation.Item
                to="/footer-item"
                onClick={e => {
                  e.preventDefault();
                  setActiveItem('footer-item');
                }}
                isActive={activeItem === 'footer-item'}
              >
                Footer Item
              </SecondaryNavigation.Item>
            </SecondaryNavigation.Footer>
          </StyledSecondaryNavigation>
        </NavigationContextProvider>
      </Container>
    );
  });
});

const Container = styled(NegativeSpaceContainer)`
  padding: ${p => p.theme.space.xl};
`;

const StyledSecondaryNavigation = styled(SecondaryNavigation)`
  height: 500px;
  width: 300px;
  background: ${p => p.theme.tokens.background.primary};
`;
