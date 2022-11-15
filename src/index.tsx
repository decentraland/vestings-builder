import React from "react";
import ReactDOM from "react-dom";
import { createBrowserRouter, RouterProvider, redirect } from "react-router-dom";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import App from "./App";
import CreateInBatch from "./CreateInBatch";
import "./index.css";

function getLibrary(provider: any) {
  return new Web3Provider(provider);
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/batch",
    element: <CreateInBatch />,
  },
  {
    path: "/v2",
    element: <div>/v2</div>,
  },
  {
    path: "/v2/batch",
    element: <div>/v2/batch</div>,
  },
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

ReactDOM.render(
  <Web3ReactProvider getLibrary={getLibrary}>
    <RouterProvider router={router} />
  </Web3ReactProvider>,
  document.getElementById("root")
);
