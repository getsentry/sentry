import {Component} from 'react';
import ReactDOM from 'react-dom';
import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react'; // This is needed to set "speedy" = false (for percy)

import {loadPreferencesState} from 'app/actionCreators/preferences';
import ConfigStore from 'app/stores/configStore';
import GlobalStyles from 'app/styles/global';
import {Config} from 'app/types';
import {darkTheme, lightTheme, Theme} from 'app/utils/theme';
import withConfig from 'app/utils/withConfig';

type Props = {
  config: Config;
};

type State = {
  theme: Theme;
};

class Main extends Component<Props, State> {
  state: State = {
    theme: this.themeName === 'dark' ? darkTheme : lightTheme,
  };

  componentDidMount() {
    loadPreferencesState();
  }

  componentDidUpdate(prevProps: Props) {
    const {config} = this.props;
    if (config.theme !== prevProps.config.theme) {
      // eslint-disable-next-line
      this.setState({
        theme: config.theme === 'dark' ? darkTheme : lightTheme,
      });
    }
  }

  get themeName() {
    return ConfigStore.get('theme');
  }

  render() {
    return (
      <ThemeProvider theme={this.state.theme}>
        <GlobalStyles
          isDark={this.props.config.theme === 'dark'}
          theme={this.state.theme}
        />
        <CacheProvider value={cache}>{this.props.children}</CacheProvider>
        {ReactDOM.createPortal(
          <meta name="color-scheme" content={this.themeName} />,
          document.head
        )}
      </ThemeProvider>
    );
  }
}

export default withConfig(Main);
