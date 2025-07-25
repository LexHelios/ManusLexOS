import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PlusIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { cn, formatBytes, timeAgo } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';

// Mock data for file library
const mockFiles = [
  {
    id: '1',
    name: 'research-notes.md',
    type: 'text/markdown',
    size: 1024 * 25,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    path: '/files/research-notes.md',
  },
  {
    id: '2',
    name: 'project-plan.pdf',
    type: 'application/pdf',
    size: 1024 * 1024 * 2.5,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    path: '/files/project-plan.pdf',
  },
  {
    id: '3',
    name: 'data-analysis.csv',
    type: 'text/csv',
    size: 1024 * 512,
    createdAt: Date.now() - 1000 * 60 * 30,
    path: '/files/data-analysis.csv',
  },
  {
    id: '4',
    name: 'presentation.pptx',
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 1024 * 1024 * 5.2,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    path: '/files/presentation.pptx',
  },
  {
    id: '5',
    name: 'product-image.jpg',
    type: 'image/jpeg',
    size: 1024 * 1024 * 1.8,
    createdAt: Date.now() - 1000 * 60 * 15,
    path: '/files/product-image.jpg',
  },
];

const FileLibrary: React.FC = () => {
  const [files, setFiles] = useState(mockFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // File upload handling with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      // In a real app, we would upload these files to the server
      // For now, we'll just add them to our mock data
      const newFiles = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
        path: `/files/${file.name}`,
      }));
      
      setFiles([...newFiles, ...files]);
    },
  });
  
  // Filter files based on search query
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <PhotoIcon className="h-8 w-8 text-blue-500" />;
    } else if (type === 'application/pdf') {
      return <DocumentTextIcon className="h-8 w-8 text-red-500" />;
    } else if (type.includes('spreadsheet') || type === 'text/csv') {
      return <DocumentIcon className="h-8 w-8 text-green-500" />;
    } else if (type.includes('presentation')) {
      return <DocumentIcon className="h-8 w-8 text-orange-500" />;
    } else {
      return <DocumentIcon className="h-8 w-8 text-gray-500" />;
    }
  };
  
  // Delete a file
  const handleDeleteFile = (id: string) => {
    setFiles(files.filter((file) => file.id !== id));
    if (selectedFile === id) {
      setSelectedFile(null);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-9"
            />
          </div>
          
          <Button variant="outline" className="gap-1">
            <PlusIcon className="h-4 w-4" />
            <span>New File</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex">
        <div className="w-1/2 border-r border-border overflow-y-auto">
          <div 
            {...getRootProps()} 
            className={cn(
              "m-4 p-6 border-2 border-dashed border-border rounded-lg text-center cursor-pointer transition-colors",
              isDragActive && "border-primary/50 bg-primary/5"
            )}
          >
            <input {...getInputProps()} />
            <ArrowDownTrayIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? "Drop files here..."
                : "Drag & drop files here, or click to select files"}
            </p>
          </div>
          
          <div className="px-2">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files found.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center p-2 rounded-md cursor-pointer",
                      selectedFile === file.id
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-secondary/50"
                    )}
                    onClick={() => setSelectedFile(file.id)}
                  >
                    <div className="mr-3">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        <span>{formatBytes(file.size)}</span>
                        <span className="mx-1">•</span>
                        <span>{timeAgo(file.createdAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="w-1/2 overflow-y-auto">
          {selectedFile ? (
            <div className="p-4">
              {(() => {
                const file = files.find((f) => f.id === selectedFile);
                if (!file) return null;
                
                if (file.type.startsWith('image/')) {
                  return (
                    <div>
                      <div className="bg-muted rounded-lg p-2 mb-4">
                        <img
                          src={file.path}
                          alt={file.name}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                      <h2 className="text-lg font-medium mb-2">{file.name}</h2>
                      <div className="text-sm text-muted-foreground">
                        <p>Type: {file.type}</p>
                        <p>Size: {formatBytes(file.size)}</p>
                        <p>Created: {new Date(file.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div>
                    <div className="bg-muted rounded-lg p-4 mb-4 flex items-center justify-center h-64">
                      {getFileIcon(file.type)}
                      <span className="ml-2 text-lg font-medium">{file.name}</span>
                    </div>
                    <h2 className="text-lg font-medium mb-2">{file.name}</h2>
                    <div className="text-sm text-muted-foreground">
                      <p>Type: {file.type}</p>
                      <p>Size: {formatBytes(file.size)}</p>
                      <p>Created: {new Date(file.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" className="gap-1">
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span>Download</span>
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a file to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileLibrary;

