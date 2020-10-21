import { Component } from 'react';

import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {IconDownload} from 'app/icons';
import {t} from 'app/locale';

import {
  ResultViewActions,
  ResultViewButtons,
  ResultViewDropdownButtons,
  DownloadCsvButton,
} from '../styles';

type Option = {
  id: string;
  name: string;
};

type Props = {
  options: Option[];
  handleChange: (id: string) => void;
  handleCsvDownload: () => void;
  visualization: string;
};

class VisualizationsToggle extends Component<Props> {
  getMenuItem = (opt: Option) => (
    <MenuItem
      key={opt.id}
      onSelect={this.props.handleChange}
      eventKey={opt.id}
      isActive={opt.id === this.props.visualization}
    >
      {opt.name}
    </MenuItem>
  );

  getButtonItems = (opt: Option) => {
    const active = opt.id === this.props.visualization;
    return (
      <li key={opt.id} className={active ? 'active' : undefined}>
        <a onClick={() => this.props.handleChange(opt.id)}>{opt.name}</a>
      </li>
    );
  };

  getDownloadCsvButton = () => {
    const {handleCsvDownload} = this.props;
    return (
      <DownloadCsvButton
        onClick={handleCsvDownload}
        icon={<IconDownload size="xs" />}
        size="xsmall"
      >
        {t('Export CSV')}
      </DownloadCsvButton>
    );
  };

  render() {
    const {options, visualization} = this.props;
    const name = options.find(opt => opt.id === visualization)!.name;
    const dropdownTitle = t(`View: ${name}`);

    return (
      <ResultViewActions>
        <ResultViewButtons>
          {options.map(opt => this.getButtonItems(opt))}
        </ResultViewButtons>
        <ResultViewDropdownButtons>
          <DropdownLink title={dropdownTitle} className="btn btn-default btn-sm">
            {options.map(opt => this.getMenuItem(opt))}
          </DropdownLink>
        </ResultViewDropdownButtons>
        {this.getDownloadCsvButton()}
      </ResultViewActions>
    );
  }
}

export default VisualizationsToggle;
