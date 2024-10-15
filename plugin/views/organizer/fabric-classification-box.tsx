import * as React from "react";
import { Notice, TFile, TFolder } from "obsidian";
import FileOrganizer from "../../index";

interface FabricClassificationBoxProps {
  plugin: FileOrganizer;
  file: TFile | null;
  content: string;
  refreshKey: number;
}

type FabricPattern = {
  name: string;
};

export const FabricClassificationBox: React.FC<FabricClassificationBoxProps> = ({
  plugin,
  file,
  content,
  refreshKey,
}) => {
  const [fabricPatterns, setFabricPatterns] = React.useState<FabricPattern[]>([]);
  const [selectedFabricPattern, setSelectedFabricPattern] = React.useState<FabricPattern | null>(null);
  const [showFabricDropdown, setShowFabricDropdown] = React.useState<boolean>(false);
  const [isFormatting, setIsFormatting] = React.useState<boolean>(false);
  const [loadStatus, setLoadStatus] = React.useState<"success" | "error">("success");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const fabricDropdownRef = React.useRef<HTMLDivElement>(null);
  const patternsPath = React.useMemo(() => 
    `${plugin.settings.fabricPatternPath.replace(/\/$/, "")}/patterns`,
    [plugin.settings.fabricPatternPath]
  );

  /**
   * Formats content using Fabric structure.
   */
  const formatFabricContent = async (params: {
    file: TFile;
    content: string;
    systemContent: string;
  }): Promise<void> => {
    try {
      new Notice("Formatting content with Fabric...", 3000);
      const response = await fetch(`${plugin.getServerUrl()}/api/fabric-classify/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
        body: JSON.stringify({
          content: params.content,
          systemContent: params.systemContent,
          enableFabric: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Fabric formatting failed with status: ${response.status}`);
      }

      const data = await response.json();
      await plugin.app.vault.modify(params.file, data.formattedContent);
      new Notice("Content formatted successfully with Fabric.", 3000);
    } catch (error) {
      console.error("Error in formatFabricContent:", error);
      new Notice(`Formatting failed: ${(error as Error).message}`, 5000);
    }
  };

  React.useEffect(() => {
    const fetchFabricPatternsEffect = async () => {
      if (!content || !file) {
        setLoadStatus("error");
        console.error("No content or file available for Fabric classification");
        return;
      }

      try {
        console.log(patternsPath);
        const patternFolder = plugin.app.vault.getAbstractFileByPath(patternsPath);
        console.log(patternFolder);

        if (!patternFolder || !(patternFolder instanceof TFolder)) {
          throw new Error(`Fabric patterns directory not found: ${patternsPath}`);
        }

        const folders = patternFolder.children.filter(file => file instanceof TFolder) as TFolder[];
        const patterns = folders.map(folder => ({ name: folder.name }));

        if (!patterns.length) {
          throw new Error("No Fabric patterns found");
        }

        setFabricPatterns(patterns);
        setLoadStatus("success");
      } catch (error) {
        console.error("Error fetching Fabric patterns:", error);
        setLoadStatus("error");
        setFabricPatterns([]);
      }
    };

    fetchFabricPatternsEffect();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        fabricDropdownRef.current &&
        !fabricDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFabricDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [content, file, plugin, refreshKey, patternsPath]);

  /**
   * Handles applying the selected Fabric pattern.
   */
  const handleApplyFabric = async (pattern: FabricPattern) => {
    try {
      setIsFormatting(true);
      if (!file) throw new Error("No file selected");
      if (!pattern || typeof pattern.name !== "string") {
        throw new Error("Invalid Fabric pattern");
      }

      const systemFilePath = `${patternsPath}/${pattern.name}/system.md`;
      const systemFile = plugin.app.vault.getAbstractFileByPath(systemFilePath) as TFile;

      if (!systemFile) {
        throw new Error(`System file not found for pattern: ${pattern.name}`);
      }

      const systemContent = await plugin.app.vault.read(systemFile);
      const fileContent = await plugin.app.vault.read(file);

      await formatFabricContent({
        file,
        content: fileContent,
        systemContent,
      });

      setSelectedFabricPattern(null);
    } catch (error) {
      console.error("Error in handleApplyFabric:", error);
      setErrorMessage((error as Error).message);
    } finally {
      setIsFormatting(false);
    }
  };

  /**
   * Returns display text based on selected Fabric pattern.
   */
  const getFabricDisplayText = () => {
    if (selectedFabricPattern) {
      return `Format as ${selectedFabricPattern.name}`;
    }
    return "Select Fabric Pattern";
  };

  const availableFabricPatterns = fabricPatterns.filter(
    t => t.name !== selectedFabricPattern?.name
  );

  /**
   * Renders the Fabric pattern selection UI.
   */
  const renderFabricContent = () => {
    if (loadStatus === "error") {
      return (
        <div className="text-[--text-error] p-2 rounded-md bg-[--background-modifier-error]">
          Unable to load Fabric patterns. Please download them from the customization tab.
        </div>
      );
    }

    return (
      <div className="flex flex-col space-y-2">
        <div className="relative" ref={fabricDropdownRef}>
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-[--background-secondary] text-[--text-normal] rounded-md hover:bg-[--background-modifier-hover] transition-colors duration-200"
            onClick={() => setShowFabricDropdown(!showFabricDropdown)}
          >
            <span>{getFabricDisplayText()}</span>
            <svg
              className="w-4 h-4 ml-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 9L12 15L18 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showFabricDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-[--background-primary] border border-[--background-modifier-border] rounded-md shadow-lg">
              {availableFabricPatterns.length > 0 ? (
                availableFabricPatterns.map((pattern, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 cursor-pointer hover:bg-[--background-modifier-hover] text-[--text-normal]"
                    onClick={() => {
                      setSelectedFabricPattern(pattern);
                      setShowFabricDropdown(false);
                    }}
                  >
                    {pattern.name}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-[--text-muted]">No Fabric patterns available</div>
              )}
            </div>
          )}
        </div>
        <button
          className={`px-4 py-2 rounded-md transition-colors duration-200 ${
            !selectedFabricPattern || isFormatting
              ? 'bg-[--background-modifier-border] text-[--text-muted] cursor-not-allowed'
              : 'bg-[--interactive-accent] text-white hover:bg-[--interactive-accent-hover]'
          }`}
          disabled={!selectedFabricPattern || isFormatting}
          onClick={() => selectedFabricPattern && handleApplyFabric(selectedFabricPattern)}
        >
          {isFormatting ? "Applying..." : "Apply"}
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[--background-primary-alt] text-[--text-normal] p-4 rounded-lg shadow-md">
      {renderFabricContent()}
      {errorMessage && <div className="mt-2 text-[--text-error] p-2 rounded-md bg-[--background-modifier-error]">{errorMessage}</div>}
    </div>
  );
};