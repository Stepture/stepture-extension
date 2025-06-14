import { record } from "../constants/images";
type Props = {
  color: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
};

const Button = (props: Props) => {
  return (
    <div>
      <button
        onClick={props.onClick}
        type="button"
        className={props.color === "primary" ? "btn-primary" : "btn-secondary"}
      >
        <div className="flex items-center justify-center gap-1">
          {props.color === "primary" && (
            <img src={record} alt={`${props.text} button`} />
          )}
          {props.text}
        </div>
      </button>
    </div>
  );
};

export default Button;
