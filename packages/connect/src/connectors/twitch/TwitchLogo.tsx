import type { FunctionComponent } from 'react'

import type { LogoProps } from '../../types.js'

interface GetTwitchLogo {
  isDarkMode?: boolean
}

export const getTwitchLogo = ({ isDarkMode }: GetTwitchLogo) => {
  let fillColor: string
  if (isDarkMode === undefined) {
    fillColor = '#9146FF'
  } else {
    fillColor = isDarkMode ? 'white' : 'black'
  }

  const TwitchLogo: FunctionComponent<LogoProps> = props => {
    return (
      <svg
        version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        x="0px"
        y="0px"
        viewBox="0 0 2400 2800"
        transform="scale(0.80)"
        {...props}
      >
        <g>
          <g id="Layer_1-2">
            <path
              fill={fillColor}
              d="M500,0L0,500v1800h600v500l500-500h400l900-900V0H500z M2200,1300l-400,400h-400l-350,350v-350H600V200h1600
                  V1300z"
            />
            <rect width="200" height="600" x="1700" y="550" fill={fillColor} />
            <rect width="200" height="600" x="1150" y="550" fill={fillColor} />
          </g>
        </g>
      </svg>
    )
  }
  return TwitchLogo
}
