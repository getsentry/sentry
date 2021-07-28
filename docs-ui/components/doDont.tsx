import {styled} from '@storybook/theming';
import {Component} from 'react';

import {IconCheckmark, IconClose} from 'app/icons';
import theme from 'app/utils/theme';

type BoxContent = {
	text: string;
	img: {
		src: string;
		alt: string;
	};
}
type Props = {
	boxes: {
		do: BoxContent,
		dont: BoxContent
	}
}
const DDWrapper = styled('div')`
	display: flex;
	justify-content: space-between;
	width: 100%;
	margin: 16px auto;
	@media only screen and (max-width: ${theme.breakpoints[1]}) {
		flex-wrap: wrap;
		margin: 32px auto;
	}
`;
const DDBox = styled('div')`
	display: flex;
	flex-direction: column;
	height: 100%;
	width: calc(50% - ${p => p.theme.layoutMargin/2}px);
	@media only screen and (max-width: ${theme.breakpoints[1]}) {
		width: 100%;
		margin-bottom: ${p => p.theme.layoutMargin}px;
	}
`;
const DDImgWrap = styled('div')`
	position: relative;
	width: 100%;
	padding-top: 50%;
	border: solid 1px ${theme.gray100};
	border-radius: ${p => p.theme.appBorderRadius}px;
	overflow: hidden;
`;
const DDImg = styled('img')`
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
`;
const DDCaptions = styled('div')`
	display: flex;
	align-items: flex-start;
	width: 100%;
	padding: ${p => p.theme.layoutMargin}px;
	@media only screen and (max-width: ${theme.breakpoints[1]}) {
		flex-wrap: wrap;
	}
`;
const DDLabelWrap = styled('div')`
	display: flex;
	align-items: center;
	flex-shrink: 0;
	width: 6em;
	margin-top: 0.25em;
	@media only screen and (max-width: ${theme.breakpoints[1]}) {
		flex-direction: row-reverse;
		justify-content: flex-end;
		margin-bottom: ${p => p.theme.layoutMargin/2}px;
	}
`
const DDLabel = styled('p')`
	font-weight: 600;
	line-height: 1;
	margin-left: ${p => p.theme.layoutMargin}px;
	margin-bottom: 0;
	&.DD-do {
		color: ${theme.green300};
	}
	&.DD-dont {
		color: ${theme.red300};
	}
	@media only screen and (max-width: ${theme.breakpoints[1]}) {
		margin-left: 0;
		margin-right: ${p => p.theme.layoutMargin/2}px;
	}
`
const DDText = styled('p')`
	margin-bottom: 0;
	color: ${theme.gray300};
`
class DoDont extends Component<Props> {
	render() {
		const {boxes} = this.props
		return (
			<DDWrapper>
				<DDBox>
					<DDImgWrap>
						<DDImg src={boxes.do.img.src} alt={boxes.do.img.alt} />
					</DDImgWrap>
					<DDCaptions>
						<DDLabelWrap>
							<IconCheckmark theme={theme} color="green300" />
							<DDLabel className="DD-do">DO</DDLabel>
						</DDLabelWrap>
						<DDText>{boxes.do.text}</DDText>
					</DDCaptions>
				</DDBox>
				<DDBox>
					<DDImgWrap>
						<DDImg src={boxes.do.img.src} alt={boxes.do.img.alt} />
					</DDImgWrap>
					<DDCaptions>
						<DDLabelWrap>
							<IconClose theme={theme} color="red300" />
							<DDLabel className="DD-dont">DON'T</DDLabel>
						</DDLabelWrap>
						<DDText>{boxes.dont.text}</DDText>
					</DDCaptions>
				</DDBox>
			</DDWrapper>
		)
	}
};
export default DoDont;
