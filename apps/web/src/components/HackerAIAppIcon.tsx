// The production icon, as GitHub shows the HackerAI app, whatever this build's channel.
import appIconUrl from "../../../../assets/prod/hackerai-black-web-apple-touch-180.png";

export function HackerAIAppIcon(props: { readonly className?: string }) {
  return <img src={appIconUrl} alt="" className={props.className} />;
}
